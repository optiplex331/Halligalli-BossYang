from __future__ import annotations

import asyncio
import json
import re
import time
import unittest

from fastapi.testclient import TestClient
from halligalli_api.app import create_app
from halligalli_api.authority import Bell, Ready, RedisMultiplayerAuthority, Start, StaleBellResult
from halligalli_api.observability import Telemetry
from redis_test_case import FixedDeck, ManualClock, RedisAsyncTestCase, RedisTestCase, hash_credential


def _sample(metrics: str, series: str) -> float:
    match = re.search(rf"^{re.escape(series)} (\S+)$", metrics, re.MULTILINE)
    if match is None:
        raise AssertionError(f"{series} missing from metrics")
    return float(match.group(1))


class ObservabilityTest(RedisTestCase):
    def test_operational_surfaces_emit_redacted_trace_and_metrics(self) -> None:
        credential = "do-not-log-this-credential"
        authority = self.authority
        with self.assertLogs("halligalli.telemetry", level="INFO") as captured, TestClient(create_app(authority)) as client:
            created = client.post(
                "/api/v1/rooms",
                headers={"Idempotency-Key": "c97c807c-4c73-4ea0-bfc7-2a8bd4d68cce"},
                json={"name": "Host", "credentialVerifier": hash_credential(credential), "tableSeatCount": 4, "targetHumanParticipantCount": 2, "difficulty": "normal"},
            )
            with client.websocket_connect(f"/ws/v1/rooms/{created.json()['roomCode']}") as websocket:
                websocket.send_text(json.dumps({"type": "authenticate", "credential": credential}))
                websocket.receive_json()
            metrics = client.get("/internal/metrics")
            identity = client.get("/internal/identity")
            readiness = client.get("/internal/ready")

        self.assertEqual(created.status_code, 201)
        self.assertIn("halligalli_http_requests_total", metrics.text)
        self.assertIn("halligalli_active_rooms 1", metrics.text)
        self.assertEqual(_sample(metrics.text, 'halligalli_command_latency_seconds_bucket{command="authenticate",le="+Inf"}'), 1)
        self.assertGreaterEqual(_sample(metrics.text, "halligalli_due_processing_seconds_count"), 1)
        self.assertEqual(identity.status_code, 200)
        self.assertEqual(readiness.status_code, 200)
        lines = "\n".join(captured.output)
        self.assertNotIn(credential, lines)
        self.assertNotIn(hash_credential(credential), lines)
        trace = json.loads(captured.output[0].split(":", 2)[-1])
        self.assertEqual(trace["event"], "trace")
        self.assertIn("trace_id", trace)

    def test_runtime_summary_is_printed_when_an_interval_is_configured(self) -> None:
        with self.assertLogs("halligalli.telemetry", level="INFO") as captured, TestClient(
            create_app(self.authority, summary_interval_seconds=0.01),
        ):
            time.sleep(0.2)

        self.assertTrue(any('"event":"runtime_summary"' in line for line in captured.output))


class RuntimeMeasurementTest(RedisAsyncTestCase):
    async def asyncSetUp(self) -> None:
        await super().asyncSetUp()
        self.telemetry = Telemetry()
        self.clock = ManualClock()
        self.authority = RedisMultiplayerAuthority(self.redis, self.telemetry, clock=self.clock, deck=FixedDeck())

    async def _playing_room(self, room_id: str) -> tuple[str, list[str], int]:
        created, credentials = await self.create_room(room_id, (("Host", f"{room_id}-host"), ("Guest", f"{room_id}-guest")))
        await asyncio.gather(*(self.authority.execute(created.room_code, Ready(credential)) for credential in credentials))
        started = await self.authority.execute(created.room_code, Start(credentials[0], now_ms=self.clock.now_ms))
        return created.room_code, credentials, started.snapshot.turn_deadline_at

    def _metric(self, series: str) -> float:
        return _sample(self.telemetry.metrics(active_rooms=0), series)

    async def test_tick_lateness_is_measured_when_the_advance_commits(self) -> None:
        _, _, deadline = await self._playing_room("late")
        self.clock.now_ms = deadline + 40

        await self.authority.advance_due()

        lateness = "halligalli_turn_tick_lateness_seconds"
        self.assertEqual(self._metric(f'{lateness}_bucket{{le="0.025"}}'), 0)
        self.assertEqual(self._metric(f'{lateness}_bucket{{le="0.05"}}'), 1)
        self.assertEqual(self._metric(f"{lateness}_count"), 1)
        self.assertAlmostEqual(self._metric(f"{lateness}_sum"), 0.04)

    async def test_bell_outcomes_and_watch_retries_are_counted(self) -> None:
        room_code, (host, guest), deadline = await self._playing_room("bells")
        self.clock.now_ms = deadline
        await self.authority.advance_due()  # the second reveal opens a banana Bell Window
        won = await self.authority.execute(room_code, Bell(host, now_ms=deadline + 300, command_id="win", reveal_sequence=2))
        await self.authority.execute(room_code, Bell(host, now_ms=deadline + 300, command_id="win", reveal_sequence=2))
        late = await self.authority.execute(room_code, Bell(guest, now_ms=deadline + 310, reveal_sequence=2))
        self.clock.now_ms = won.snapshot.turn_deadline_at
        await self.authority.advance_due()
        await self.authority.execute(room_code, Bell(host, now_ms=self.clock.now_ms, reveal_sequence=3))

        missed_room, _, missed_deadline = await self._playing_room("missed")
        self.clock.now_ms = missed_deadline
        await self.authority.advance_due()
        self.clock.now_ms += 1_500
        await self.authority.advance_due()

        self.assertIsInstance(late, StaleBellResult)
        bells = "halligalli_bell_outcomes_total"
        for outcome in ("correct", "wrong", "stale", "missed"):
            self.assertEqual(self._metric(f'{bells}{{outcome="{outcome}"}}'), 1, outcome)
        # The concurrent readies in each room race on one WATCHed room key.
        self.assertGreaterEqual(self._metric('halligalli_watch_retries_total{operation="room_command"}'), 1)
