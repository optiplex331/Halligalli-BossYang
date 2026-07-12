from __future__ import annotations

import hashlib
import unittest

from fastapi.testclient import TestClient

from halligalli_api.app import create_app
from halligalli_api.authority import InMemoryMultiplayerAuthority


def verifier(credential: str) -> str:
    return hashlib.sha256(credential.encode()).hexdigest()


class WebSocketMatchTest(unittest.TestCase):
    def test_two_websocket_players_ready_start_and_receive_a_bell_result(self) -> None:
        authority = InMemoryMultiplayerAuthority(room_codes=iter(["ABCD"]))
        host_credential = "host-credential"
        guest_credential = "guest-credential"

        with TestClient(create_app(authority=authority)) as client:
            client.post(
                "/api/v1/rooms",
                headers={"Idempotency-Key": "c97c807c-4c73-4ea0-bfc7-2a8bd4d68cce"},
                json={"name": "Host", "credentialVerifier": verifier(host_credential)},
            )
            client.post(
                "/api/v1/rooms/ABCD/participants",
                headers={"Idempotency-Key": "9e5c8ba0-298e-460e-92ed-47fb646e539e"},
                json={"name": "Guest", "credentialVerifier": verifier(guest_credential)},
            )

            with client.websocket_connect("/ws/v1/rooms/ABCD") as host_socket, client.websocket_connect(
                "/ws/v1/rooms/ABCD",
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
                finished = host_socket.receive_json()

        self.assertEqual(started["snapshot"]["phase"], "playing")
        self.assertEqual(bell_window["snapshot"]["bellFruit"], "banana")
        self.assertEqual(finished["snapshot"]["phase"], "post_match")
        self.assertEqual(finished["snapshot"]["result"]["score"], 207)

    def test_deadlines_publish_a_missed_bell_result(self) -> None:
        authority = InMemoryMultiplayerAuthority(room_codes=iter(["WXYZ"]))
        host_credential = "host-credential"
        guest_credential = "guest-credential"

        with TestClient(create_app(authority=authority)) as client:
            client.post(
                "/api/v1/rooms",
                headers={"Idempotency-Key": "c97c807c-4c73-4ea0-bfc7-2a8bd4d68cce"},
                json={"name": "Host", "credentialVerifier": verifier(host_credential)},
            )
            client.post(
                "/api/v1/rooms/WXYZ/participants",
                headers={"Idempotency-Key": "9e5c8ba0-298e-460e-92ed-47fb646e539e"},
                json={"name": "Guest", "credentialVerifier": verifier(guest_credential)},
            )

            with client.websocket_connect("/ws/v1/rooms/WXYZ") as host_socket, client.websocket_connect(
                "/ws/v1/rooms/WXYZ",
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
                host_socket.receive_json()
                guest_socket.receive_json()
                bell_window = host_socket.receive_json()
                guest_socket.receive_json()
                missed = host_socket.receive_json()

        self.assertEqual(bell_window["snapshot"]["bellFruit"], "banana")
        self.assertEqual(missed["snapshot"]["phase"], "post_match")
        self.assertEqual(missed["snapshot"]["lastEvent"], "missed_bell")
        self.assertEqual(missed["snapshot"]["scoreboard"][0]["missedHits"], 1)
