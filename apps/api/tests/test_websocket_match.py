from __future__ import annotations

import hashlib
import unittest

from fastapi.testclient import TestClient

from halligalli_api.app import create_app
from redis_test_case import RedisTestCase


def verifier(credential: str) -> str:
    return hashlib.sha256(credential.encode()).hexdigest()


class WebSocketMatchTest(RedisTestCase):
    def test_two_websocket_players_ready_start_and_receive_a_bell_result(self) -> None:
        authority = self.authority
        host_credential = "host-credential"
        guest_credential = "guest-credential"

        with TestClient(create_app(authority=authority)) as client:
            created = client.post(
                "/api/v1/rooms",
                headers={"Idempotency-Key": "c97c807c-4c73-4ea0-bfc7-2a8bd4d68cce"},
                json={"name": "Host", "credentialVerifier": verifier(host_credential), "tableSeatCount": 4, "targetHumanParticipantCount": 2, "difficulty": "normal", "durationSec": 60},
            )
            room_code = created.json()["roomCode"]
            client.post(
                f"/api/v1/rooms/{room_code}/participants",
                headers={"Idempotency-Key": "9e5c8ba0-298e-460e-92ed-47fb646e539e"},
                json={"name": "Guest", "credentialVerifier": verifier(guest_credential)},
            )

            with client.websocket_connect(f"/ws/v1/rooms/{room_code}") as host_socket, client.websocket_connect(
                f"/ws/v1/rooms/{room_code}",
            ) as guest_socket:
                host_socket.send_json({"type": "authenticate", "credential": host_credential})
                guest_socket.send_json({"type": "authenticate", "credential": guest_credential})
                host_socket.receive_json()
                guest_socket.receive_json()

                host_socket.send_json({"type": "ready"})
                host_socket.receive_json()
                guest_socket.receive_json()
                guest_socket.send_json({"type": "ready"})
                host_socket.receive_json()
                guest_socket.receive_json()

                host_socket.send_json({"type": "start"})
                started = host_socket.receive_json()
                guest_socket.receive_json()
                bell_window = host_socket.receive_json()
                guest_socket.receive_json()
                host_socket.send_json({"type": "bell"})
                continued = host_socket.receive_json()

        self.assertEqual(started["snapshot"]["phase"], "playing")
        self.assertEqual(bell_window["snapshot"]["bellFruit"], "banana")
        self.assertEqual(continued["snapshot"]["phase"], "playing")
        self.assertIsNone(continued["snapshot"]["result"])
        self.assertEqual(continued["snapshot"]["scoreboard"][0]["score"], 207)
