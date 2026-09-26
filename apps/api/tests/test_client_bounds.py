from __future__ import annotations

from uuid import uuid4

from fastapi.testclient import TestClient
from redis.asyncio import Redis
from starlette.websockets import WebSocketDisconnect

from halligalli_api.app import WEBSOCKET_MAX_MESSAGE_BYTES, create_app
from halligalli_api.authority import RedisMultiplayerAuthority
from redis_test_case import FixedDeck, REDIS_URL, RedisTestCase, hash_credential


class ClientBoundsTest(RedisTestCase):
    def _client(self, *, trusted_proxy_hops: int, room_creation_budget: int) -> TestClient:
        authority = RedisMultiplayerAuthority(
            Redis.from_url(REDIS_URL, decode_responses=True),
            deck=FixedDeck(),
            clock=self.clock,
            room_creation_budget=room_creation_budget,
        )
        return TestClient(create_app(authority=authority, trusted_proxy_hops=trusted_proxy_hops))

    @staticmethod
    def _create(client: TestClient, forwarded_for: str | None = None):
        headers = {"Idempotency-Key": str(uuid4())}
        if forwarded_for is not None:
            headers["X-Forwarded-For"] = forwarded_for
        return client.post(
            "/api/v1/rooms",
            headers=headers,
            json={
                "name": "Host",
                "credentialVerifier": hash_credential("host"),
                "tableSeatCount": 4,
                "targetHumanParticipantCount": 2,
                "difficulty": "normal",
            },
        )

    def test_budget_keys_on_the_client_written_by_the_outermost_trusted_proxy(self) -> None:
        # Two trusted hops, as on Container Apps: platform ingress, then the local nginx.
        with self._client(trusted_proxy_hops=2, room_creation_budget=1) as client:
            first = self._create(client, "203.0.113.7, 10.0.0.5")
            other_client = self._create(client, "198.51.100.9, 10.0.0.5")
            spoofed_prefix = self._create(client, "192.0.2.1, 203.0.113.7, 10.0.0.5")

        self.assertEqual(first.status_code, 201)
        self.assertEqual(other_client.status_code, 201)
        self.assertEqual(spoofed_prefix.status_code, 429)
        self.assertEqual(spoofed_prefix.json()["code"], "room_creation_limited")

    def test_forwarded_headers_are_ignored_without_trusted_proxies(self) -> None:
        with self._client(trusted_proxy_hops=0, room_creation_budget=2) as client:
            statuses = [
                self._create(client, forwarded_for).status_code
                for forwarded_for in ("203.0.113.7", "198.51.100.9", None)
            ]

        self.assertEqual(statuses, [201, 201, 429])

    def test_oversized_websocket_messages_close_the_socket(self) -> None:
        with TestClient(create_app(authority=self.authority)) as client:
            room_code = self._create(client).json()["roomCode"]
            with client.websocket_connect(f"/ws/v1/rooms/{room_code}") as socket:
                socket.send_json({"type": "authenticate", "credential": "host"})
                socket.receive_json()
                socket.send_text("x" * (WEBSOCKET_MAX_MESSAGE_BYTES + 1))
                with self.assertRaises(WebSocketDisconnect) as closed:
                    socket.receive_json()

        self.assertEqual(closed.exception.code, 1009)
