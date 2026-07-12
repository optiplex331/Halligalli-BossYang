from __future__ import annotations

import hashlib
import json
import unittest

from fastapi.testclient import TestClient

from halligalli_api.app import create_app
from halligalli_api.authority import InMemoryMultiplayerAuthority


def verifier(credential: str) -> str:
    return hashlib.sha256(credential.encode()).hexdigest()


class RoomTransportTest(unittest.TestCase):
    def test_entry_requires_a_uuid_idempotency_key(self) -> None:
        client = TestClient(create_app(authority=InMemoryMultiplayerAuthority(room_codes=iter(["WXYZ"]))))

        response = client.post(
            "/api/v1/rooms",
            headers={"Idempotency-Key": "not-a-uuid"},
            json={"name": "Host", "credentialVerifier": verifier("host-credential")},
        )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.headers["content-type"], "application/problem+json")
        self.assertEqual(response.json()["code"], "invalid_request")

    def test_rest_entry_and_websocket_initial_snapshot(self) -> None:
        authority = InMemoryMultiplayerAuthority(room_codes=iter(["ABCD"]))
        client = TestClient(create_app(authority=authority))
        host_credential = "host-credential"
        guest_credential = "guest-credential"

        create = client.post(
            "/api/v1/rooms",
            headers={"Idempotency-Key": "c97c807c-4c73-4ea0-bfc7-2a8bd4d68cce"},
            json={"name": "Host", "credentialVerifier": verifier(host_credential)},
        )
        repeated = client.post(
            "/api/v1/rooms",
            headers={"Idempotency-Key": "c97c807c-4c73-4ea0-bfc7-2a8bd4d68cce"},
            json={"name": "Host", "credentialVerifier": verifier(host_credential)},
        )
        joined = client.post(
            "/api/v1/rooms/ABCD/participants",
            headers={"Idempotency-Key": "9e5c8ba0-298e-460e-92ed-47fb646e539e"},
            json={"name": "Guest", "credentialVerifier": verifier(guest_credential)},
        )

        self.assertEqual(create.status_code, 201)
        self.assertEqual(repeated.status_code, 201)
        self.assertEqual(joined.status_code, 201)
        self.assertEqual(create.json()["roomCode"], "ABCD")
        self.assertEqual(joined.json()["snapshot"]["revision"], 2)

        snapshot = client.get(
            "/api/v1/rooms/ABCD",
            headers={"Authorization": f"Bearer {host_credential}"},
        )
        guest_snapshot = client.get(
            "/api/v1/rooms/ABCD",
            headers={"Authorization": f"Bearer {guest_credential}"},
        )
        self.assertEqual(snapshot.status_code, 200)
        self.assertEqual(guest_snapshot.status_code, 200)
        self.assertEqual(snapshot.json()["viewerSeatIndex"], 0)
        self.assertEqual(guest_snapshot.json()["viewerSeatIndex"], 1)
        self.assertEqual(snapshot.json()["revision"], guest_snapshot.json()["revision"])
        self.assertEqual([item["name"] for item in snapshot.json()["participants"]], ["Host", "Guest"])
        self.assertNotIn(host_credential, json.dumps(snapshot.json()))

        with client.websocket_connect("/ws/v1/rooms/ABCD") as socket:
            socket.send_json({"type": "authenticate", "credential": host_credential})
            initial = socket.receive_json()

        self.assertEqual(initial["type"], "snapshot")
        self.assertEqual(initial["snapshot"]["revision"], 2)
        self.assertNotIn(host_credential, json.dumps(initial))
