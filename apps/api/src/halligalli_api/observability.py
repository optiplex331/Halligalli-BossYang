from __future__ import annotations

import json
import logging
import os
import sys
from collections import Counter, deque
from collections.abc import Iterator
from contextlib import contextmanager
from time import perf_counter, process_time
from typing import Literal

from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, SpanExporter
from opentelemetry.trace import Span


Outcome = Literal["success", "client_error", "server_error"]
BellOutcome = Literal["correct", "wrong", "stale", "missed"]

# Millisecond-scale buckets; 0.15 s and 0.25 s mark the load test's tick-lateness decision and abort thresholds.
LATENCY_BUCKETS_SECONDS = (0.005, 0.01, 0.025, 0.05, 0.1, 0.15, 0.25, 0.5, 1.0, 2.5)
_HISTOGRAMS = {
    "command": ("halligalli_command_latency_seconds", ("command",)),
    "due": ("halligalli_due_processing_seconds", ()),
    "lateness": ("halligalli_turn_tick_lateness_seconds", ()),
}
_COUNTERS = {
    "watch_retry": ("halligalli_watch_retries_total", ("operation",)),
    "bell": ("halligalli_bell_outcomes_total", ("outcome",)),
}
# Bounds the samples kept for one summary interval's exact p95.
_LATENESS_SAMPLE_LIMIT = 10_000


class _Histogram:
    def __init__(self) -> None:
        self.buckets = [0] * len(LATENCY_BUCKETS_SECONDS)
        self.count = 0
        self.total = 0.0

    def observe(self, seconds: float) -> None:
        for index, bound in enumerate(LATENCY_BUCKETS_SECONDS):
            if seconds <= bound:
                self.buckets[index] += 1
        self.count += 1
        self.total += seconds


def _labels(names: tuple[str, ...], values: tuple[str, ...]) -> str:
    return ",".join(f'{name}="{value}"' for name, value in zip(names, values, strict=True))


def _p95(samples: list[float]) -> float | None:
    if not samples:
        return None
    ordered = sorted(samples)
    return ordered[max(0, -(-len(ordered) * 95 // 100) - 1)]


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
        self._histograms: dict[tuple[str, ...], _Histogram] = {}
        self._counters: Counter[tuple[str, ...]] = Counter()
        self._interval_lateness: deque[float] = deque(maxlen=_LATENESS_SAMPLE_LIMIT)
        self._interval_watch_retries = 0
        self._interval_cpu_started = (process_time(), perf_counter())
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
        self._observe("command", elapsed_seconds, command)
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

    def _observe(self, kind: str, seconds: float, *labels: str) -> None:
        self._histograms.setdefault((kind, *labels), _Histogram()).observe(seconds)

    def record_due_processing(self, elapsed_seconds: float) -> None:
        self._observe("due", elapsed_seconds)

    def record_tick_lateness(self, lateness_seconds: float) -> None:
        self._observe("lateness", lateness_seconds)
        self._interval_lateness.append(lateness_seconds)

    def record_watch_retry(self, operation: str) -> None:
        self._counters[("watch_retry", operation)] += 1
        self._interval_watch_retries += 1

    def record_bell_outcome(self, outcome: BellOutcome) -> None:
        self._counters[("bell", outcome)] += 1

    def emit_runtime_summary(
        self,
        *,
        interval_seconds: float,
        active_rooms: int,
        active_sockets: int,
        redis_memory: dict[str, int] | None,
    ) -> None:
        """Print one greppable line for the interval since the previous summary, then start a new interval."""
        p95 = _p95(list(self._interval_lateness))
        memory = redis_memory or {}
        cpu_started, wall_started = self._interval_cpu_started
        cpu_now, wall_now = process_time(), perf_counter()
        # CPU cores this process used over the interval; compare with the container's CPU limit.
        api_cpu_cores = round((cpu_now - cpu_started) / max(wall_now - wall_started, 1e-9), 3)
        self._emit(
            event="runtime_summary",
            interval_s=interval_seconds,
            tick_lateness_p95_ms=None if p95 is None else round(p95 * 1000, 1),
            tick_samples=len(self._interval_lateness),
            watch_retries=self._interval_watch_retries,
            active_rooms=active_rooms,
            active_sockets=active_sockets,
            redis_used_memory_bytes=memory.get("used_memory"),
            redis_maxmemory_bytes=memory.get("maxmemory"),
            api_cpu_cores=api_cpu_cores,
        )
        self._interval_lateness.clear()
        self._interval_watch_retries = 0
        self._interval_cpu_started = (cpu_now, wall_now)

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
        for kind, (metric, names) in _HISTOGRAMS.items():
            lines.append(f"# TYPE {metric} histogram")
            for (series_kind, *labels), histogram in sorted(self._histograms.items(), key=lambda item: item[0]):
                if series_kind != kind:
                    continue
                rendered = _labels(names, tuple(labels))
                prefix = f"{rendered}," if rendered else ""
                for bound, cumulative in zip(LATENCY_BUCKETS_SECONDS, histogram.buckets, strict=True):
                    lines.append(f'{metric}_bucket{{{prefix}le="{bound}"}} {cumulative}')
                lines.append(f'{metric}_bucket{{{prefix}le="+Inf"}} {histogram.count}')
                suffix = f"{{{rendered}}}" if rendered else ""
                lines.extend((f"{metric}_count{suffix} {histogram.count}", f"{metric}_sum{suffix} {histogram.total:.6f}"))
        for kind, (metric, names) in _COUNTERS.items():
            lines.append(f"# TYPE {metric} counter")
            for (series_kind, *labels), count in sorted(self._counters.items()):
                if series_kind == kind:
                    lines.append(f"{metric}{{{_labels(names, tuple(labels))}}} {count}")
        return "\n".join(lines) + "\n"

    def shutdown(self) -> None:
        self._provider.shutdown()


def elapsed_since(started_at: float) -> float:
    return perf_counter() - started_at
