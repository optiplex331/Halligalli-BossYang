from __future__ import annotations

import unittest

from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from halligalli_api.app import create_app
from halligalli_api.authority import RedisMultiplayerAuthority
from redis_test_case import RedisTestCase, hash_credential


class StartupTest(unittest.TestCase):
    def test_startup_fails_instead_of_hanging_when_redis_is_unavailable(self) -> None:
        unavailable = RedisMultiplayerAuthority.from_url("redis://127.0.0.1:1/0")

        with self.assertRaises(Exception):
            with TestClient(create_app(authority=unavailable)):
                pass


class WebSocketMatchTest(RedisTestCase):
    def test_due_loop_reveals_the_next_card_and_players_receive_a_bell_result(self) -> None:
        authority = self.authority
        host_credential = "host-credential"
        guest_credential = "guest-credential"

        with TestClient(create_app(authority=authority)) as client:
            created = client.post(
                "/api/v1/rooms",
                headers={"Idempotency-Key": "c97c807c-4c73-4ea0-bfc7-2a8bd4d68cce"},
                json={"name": "Host", "credentialVerifier": hash_credential(host_credential), "tableSeatCount": 4, "targetHumanParticipantCount": 2, "difficulty": "normal"},
            )
            room_code = created.json()["roomCode"]
            client.post(
                f"/api/v1/rooms/{room_code}/participants",
                headers={"Idempotency-Key": "9e5c8ba0-298e-460e-92ed-47fb646e539e"},
                json={"name": "Guest", "credentialVerifier": hash_credential(guest_credential)},
            )

            with client.websocket_connect(f"/ws/v1/rooms/{room_code}") as host_socket, client.websocket_connect(
                f"/ws/v1/rooms/{room_code}",
            ) as guest_socket:
                host_socket.send_json({"type": "authenticate", "credential": host_credential})
                guest_socket.send_json({"type": "authenticate", "credential": guest_credential})
                host_initial = host_socket.receive_json()
                guest_initial = guest_socket.receive_json()

                host_socket.send_json({"type": "ready"})
                host_socket.receive_json()
                guest_socket.receive_json()
                guest_socket.send_json({"type": "ready"})
                host_socket.receive_json()
                guest_socket.receive_json()

                host_socket.send_json({"type": "start"})
                started = host_socket.receive_json()
                guest_socket.receive_json()
                self.clock.now_ms = started["snapshot"]["turnDeadlineAt"]
                bell_window = host_socket.receive_json()
                guest_socket.receive_json()
                host_socket.send_json({"type": "bell"})
                continued = host_socket.receive_json()

        self.assertEqual(started["snapshot"]["phase"], "playing")
        self.assertEqual(host_initial["snapshot"]["viewerSeatIndex"], 0)
        self.assertEqual(guest_initial["snapshot"]["viewerSeatIndex"], 1)
        self.assertEqual(bell_window["snapshot"]["bellFruit"], "banana")
        self.assertEqual(continued["snapshot"]["phase"], "playing")
        self.assertIsNone(continued["snapshot"]["result"])
        self.assertEqual(continued["snapshot"]["scoreboard"][0]["score"], 207)

    def test_room_creation_rejects_unknown_configuration_fields(self) -> None:
        with TestClient(create_app(authority=self.authority)) as client:
            rejected = client.post(
                "/api/v1/rooms",
                headers={"Idempotency-Key": "0b7f6a4e-8f0e-4a39-9d2e-0f4bd2c1f0aa"},
                json={"name": "Host", "credentialVerifier": hash_credential("host"), "tableSeatCount": 4, "targetHumanParticipantCount": 2, "difficulty": "normal", "tableColor": "green"},
            )

        self.assertEqual(rejected.status_code, 422)
        self.assertEqual(rejected.json()["code"], "invalid_request")

    def _room(self, client: TestClient, host_credential: str, guest_credential: str) -> str:
        created = client.post(
            "/api/v1/rooms",
            headers={"Idempotency-Key": "5f0f3f39-54d8-4f4f-9a53-5d3c8d0b62a1"},
            json={"name": "Host", "credentialVerifier": hash_credential(host_credential), "tableSeatCount": 4, "targetHumanParticipantCount": 2, "difficulty": "normal"},
        )
        room_code = created.json()["roomCode"]
        client.post(
            f"/api/v1/rooms/{room_code}/participants",
            headers={"Idempotency-Key": "1d8f1a8e-0a8c-4a5e-8d0e-6a4f4b0f7c11"},
            json={"name": "Guest", "credentialVerifier": hash_credential(guest_credential)},
        )
        return room_code

    def test_a_rejected_command_answers_with_an_error_frame_and_keeps_the_socket_open(self) -> None:
        with TestClient(create_app(authority=self.authority)) as client:
            room_code = self._room(client, "host", "guest")
            with client.websocket_connect(f"/ws/v1/rooms/{room_code}") as guest_socket:
                guest_socket.send_json({"type": "authenticate", "credential": "guest"})
                guest_socket.receive_json()

                guest_socket.send_json({"type": "start"})
                rejected = guest_socket.receive_json()
                guest_socket.send_json({"type": "dance"})
                invalid = guest_socket.receive_json()
                guest_socket.send_json({"type": "ready"})
                accepted = guest_socket.receive_json()

        self.assertEqual(rejected, {"type": "error", "code": "host_required", "title": "Only the host can start the match"})
        self.assertEqual((invalid["type"], invalid["code"]), ("error", "invalid_request"))
        self.assertEqual(accepted["type"], "snapshot")
        self.assertTrue(accepted["snapshot"]["participants"][1]["ready"])

    def test_a_bad_credential_closes_the_socket(self) -> None:
        with TestClient(create_app(authority=self.authority)) as client:
            room_code = self._room(client, "host", "guest")
            with client.websocket_connect(f"/ws/v1/rooms/{room_code}") as socket:
                socket.send_json({"type": "authenticate", "credential": "stranger"})
                with self.assertRaises(WebSocketDisconnect) as closed:
                    socket.receive_json()

        self.assertEqual(closed.exception.code, 1008)

    def test_room_creation_ignores_the_deprecated_duration_field_for_open_old_tabs(self) -> None:
        with TestClient(create_app(authority=self.authority)) as client:
            created = client.post(
                "/api/v1/rooms",
                headers={"Idempotency-Key": "7a8e2c35-0b6f-4a53-9f4c-6d7e8f9a0b1c"},
                json={"name": "Host", "credentialVerifier": hash_credential("host"), "tableSeatCount": 4, "targetHumanParticipantCount": 2, "difficulty": "normal", "durationSec": 60},
            )

        self.assertEqual(created.status_code, 201)
        self.assertNotIn("durationSec", created.json()["snapshot"]["configuration"])
