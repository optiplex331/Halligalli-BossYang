from __future__ import annotations

import hashlib
import json
import unittest

from fastapi.testclient import TestClient

from halligalli_api.app import create_app
from halligalli_api.authority import InMemoryMultiplayerAuthority
from halligalli_api.observability import Telemetry


class ObservabilityTest(unittest.TestCase):
    def test_operational_surfaces_emit_redacted_trace_and_metrics(self) -> None:
        credential = "do-not-log-this-credential"
        authority = InMemoryMultiplayerAuthority(room_codes=iter(["ABCD"]))
        with self.assertLogs("halligalli.telemetry", level="INFO") as captured, TestClient(create_app(authority)) as client:
            created = client.post(
                "/api/v1/rooms",
                headers={"Idempotency-Key": "c97c807c-4c73-4ea0-bfc7-2a8bd4d68cce"},
                json={"name": "Host", "credentialVerifier": hashlib.sha256(credential.encode()).hexdigest()},
            )
            metrics = client.get("/internal/metrics")
            identity = client.get("/internal/identity")
            readiness = client.get("/internal/ready")

        self.assertEqual(created.status_code, 201)
        self.assertIn("halligalli_http_requests_total", metrics.text)
        self.assertIn("halligalli_active_rooms 1", metrics.text)
        self.assertEqual(identity.status_code, 200)
        self.assertEqual(readiness.status_code, 200)
        lines = "\n".join(captured.output)
        self.assertNotIn(credential, lines)
        self.assertNotIn(hashlib.sha256(credential.encode()).hexdigest(), lines)
        trace = json.loads(captured.output[0].split(":", 2)[-1])
        self.assertEqual(trace["event"], "trace")
        self.assertIn("trace_id", trace)

    def test_metric_surface_covers_websocket_and_redis_adapter_outcomes(self) -> None:
        telemetry = Telemetry()
        telemetry.record_websocket(trace_id="trace", room_code="ABCD", command="bell", outcome="success", elapsed_seconds=0.01)
        telemetry.record_redis(operation="execute", outcome="success", elapsed_seconds=0.02)

        metrics = telemetry.metrics(active_rooms=2)

        self.assertIn('halligalli_websocket_commands_total{command="bell",outcome="success"} 1', metrics)
        self.assertIn('halligalli_redis_adapter_operations_total{operation="execute",outcome="success"} 1', metrics)
