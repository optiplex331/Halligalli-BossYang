from __future__ import annotations

import json
import logging
import secrets
from collections import Counter
from time import perf_counter
from typing import Literal


Outcome = Literal["success", "client_error", "server_error"]


class Telemetry:
    """Small stdout-only telemetry surface with no request payload capture."""

    def __init__(self) -> None:
        self._logger = logging.getLogger("halligalli.telemetry")
        self._counts: Counter[tuple[str, ...]] = Counter()
        self._durations: Counter[tuple[str, ...]] = Counter()

    @staticmethod
    def new_trace_id() -> str:
        return secrets.token_hex(16)

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
    ) -> None:
        outcome: Outcome = "success" if status_code < 400 else "client_error" if status_code < 500 else "server_error"
        labels = (method, route, outcome)
        self._counts[("http", *labels)] += 1
        self._durations[("http", *labels)] += elapsed_seconds
        fields: dict[str, object] = {
            "event": "trace", "trace_id": trace_id, "span": "http.request", "method": method,
            "route": route, "outcome": outcome, "status_code": status_code,
            "duration_ms": round(elapsed_seconds * 1000, 3),
        }
        if room_code is not None:
            fields["room_code"] = room_code
        self._emit(**fields)

    def record_websocket(self, *, trace_id: str, room_code: str, command: str, outcome: str, elapsed_seconds: float) -> None:
        labels = (command, outcome)
        self._counts[("websocket", *labels)] += 1
        self._durations[("websocket", *labels)] += elapsed_seconds
        self._emit(event="trace", trace_id=trace_id, span="websocket.command", room_code=room_code, command=command, outcome=outcome, duration_ms=round(elapsed_seconds * 1000, 3))

    def record_redis(self, *, operation: str, outcome: str, elapsed_seconds: float) -> None:
        labels = (operation, outcome)
        self._counts[("redis", *labels)] += 1
        self._durations[("redis", *labels)] += elapsed_seconds
        self._emit(event="redis.adapter", operation=operation, outcome=outcome, duration_ms=round(elapsed_seconds * 1000, 3))

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


def elapsed_since(started_at: float) -> float:
    return perf_counter() - started_at
