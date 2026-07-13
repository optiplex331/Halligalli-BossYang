from __future__ import annotations

import json
import logging
import os
import sys
from collections import Counter
from collections.abc import Iterator
from contextlib import contextmanager
from time import perf_counter
from typing import Literal

from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, SpanExporter
from opentelemetry.trace import Span


Outcome = Literal["success", "client_error", "server_error"]


class Telemetry:
    """Bounded stdout metrics plus fail-open OTLP traces with no payload capture."""

    def __init__(self, span_exporter: SpanExporter | None = None) -> None:
        self._logger = logging.getLogger("halligalli.telemetry")
        if not any(getattr(handler, "_halligalli_json", False) for handler in self._logger.handlers):
            handler = logging.StreamHandler(sys.stdout)
            handler.setFormatter(logging.Formatter("%(message)s"))
            handler._halligalli_json = True  # type: ignore[attr-defined]
            self._logger.addHandler(handler)
        self._logger.setLevel(logging.INFO)
        self._logger.propagate = False
        self._counts: Counter[tuple[str, ...]] = Counter()
        self._durations: Counter[tuple[str, ...]] = Counter()
        self._provider = TracerProvider(resource=Resource.create({"service.name": "halligalli-api"}))
        exporter = span_exporter or self._otlp_exporter()
        if exporter is not None:
            self._provider.add_span_processor(BatchSpanProcessor(exporter))
        self._tracer = self._provider.get_tracer("halligalli.telemetry")

    @staticmethod
    def _otlp_exporter() -> SpanExporter | None:
        endpoint = os.environ.get("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT")
        return OTLPSpanExporter(endpoint=endpoint, timeout=0.2) if endpoint else None

    @contextmanager
    def span(self, name: str) -> Iterator[Span]:
        with self._tracer.start_as_current_span(name) as span:
            yield span

    @staticmethod
    def trace_id(span: Span) -> str:
        return f"{span.get_span_context().trace_id:032x}"

    def _record_span(self, name: str, attributes: dict[str, str | int], span: Span | None) -> str:
        if span is not None:
            span.set_attributes(attributes)
            return self.trace_id(span)
        with self.span(name) as created_span:
            created_span.set_attributes(attributes)
            return self.trace_id(created_span)

    def _emit(self, **fields: object) -> None:
        self._logger.info(json.dumps(fields, separators=(",", ":"), sort_keys=True))

    def record_http(
        self,
        *,
        trace_id: str,
        method: str,
        route: str,
        status_code: int,
        elapsed_seconds: float,
        room_code: str | None = None,
        span: Span | None = None,
    ) -> None:
        outcome: Outcome = "success" if status_code < 400 else "client_error" if status_code < 500 else "server_error"
        labels = (method, route, outcome)
        self._counts[("http", *labels)] += 1
        self._durations[("http", *labels)] += elapsed_seconds
        trace_id = self._record_span("http.request", {
            "http.request.method": method,
            "http.route": route,
            "http.response.status_code": status_code,
            "halligalli.outcome": outcome,
        }, span)
        self._emit(
            event="trace", trace_id=trace_id, span="http.request", method=method, route=route,
            outcome=outcome, status_code=status_code, duration_ms=round(elapsed_seconds * 1000, 3),
        )

    def record_websocket(
        self,
        *,
        trace_id: str,
        room_code: str,
        command: str,
        outcome: str,
        elapsed_seconds: float,
        span: Span | None = None,
    ) -> None:
        labels = (command, outcome)
        self._counts[("websocket", *labels)] += 1
        self._durations[("websocket", *labels)] += elapsed_seconds
        trace_id = self._record_span("websocket.command", {
            "halligalli.command": command,
            "halligalli.outcome": outcome,
        }, span)
        self._emit(
            event="trace", trace_id=trace_id, span="websocket.command", command=command,
            outcome=outcome, duration_ms=round(elapsed_seconds * 1000, 3),
        )

    def record_redis(self, *, operation: str, outcome: str, elapsed_seconds: float) -> None:
        labels = (operation, outcome)
        self._counts[("redis", *labels)] += 1
        self._durations[("redis", *labels)] += elapsed_seconds
        trace_id = self._record_span("redis.adapter", {
            "db.operation.name": operation,
            "halligalli.outcome": outcome,
        }, None)
        self._emit(
            event="redis.adapter", trace_id=trace_id, operation=operation, outcome=outcome,
            duration_ms=round(elapsed_seconds * 1000, 3),
        )

    def metrics(self, *, active_rooms: int) -> str:
        lines = ["# TYPE halligalli_active_rooms gauge", f"halligalli_active_rooms {active_rooms}"]
        for (kind, *labels), count in sorted(self._counts.items()):
            metric, names = {
                "http": ("halligalli_http_requests_total", ("method", "route", "outcome")),
                "websocket": ("halligalli_websocket_commands_total", ("command", "outcome")),
                "redis": ("halligalli_redis_adapter_operations_total", ("operation", "outcome")),
            }[kind]
            rendered = ",".join(f'{name}="{value}"' for name, value in zip(names, labels, strict=True))
            lines.append(f"{metric}{{{rendered}}} {count}")
            duration = self._durations[(kind, *labels)]
            base = metric.removesuffix("_total") + "_duration_seconds"
            lines.extend((f"{base}_count{{{rendered}}} {count}", f"{base}_sum{{{rendered}}} {duration:.6f}"))
        return "\n".join(lines) + "\n"

    def shutdown(self) -> None:
        self._provider.shutdown()


def elapsed_since(started_at: float) -> float:
    return perf_counter() - started_at
