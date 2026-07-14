from __future__ import annotations

import hashlib
import unittest

from halligalli_api.authority import (
    CreateRoom,
    InMemoryMultiplayerAuthority,
    JoinRoom,
    Viewer,
)


def verifier(credential: str) -> str:
    return hashlib.sha256(credential.encode()).hexdigest()


class EntryAuthorityTest(unittest.IsolatedAsyncioTestCase):
    async def test_two_participants_share_an_idempotent_lobby_snapshot(self) -> None:
        authority = InMemoryMultiplayerAuthority(room_codes=iter(["ABCD"]))
        host_credential = "host-credential"
        guest_credential = "guest-credential"

        created = await authority.execute(
            None,
            CreateRoom(
                idempotency_key="create-1",
                name="Host",
                credential_verifier=verifier(host_credential),
                table_seat_count=4,
                target_human_participant_count=2,
                difficulty="normal",
                duration_sec=60,
            ),
        )
        repeated = await authority.execute(
            None,
            CreateRoom(
                idempotency_key="create-1",
                name="Host",
                credential_verifier=verifier(host_credential),
                table_seat_count=4,
                target_human_participant_count=2,
                difficulty="normal",
                duration_sec=60,
            ),
        )
        joined = await authority.execute(
            created.room_code,
            JoinRoom(
                idempotency_key="join-1",
                name="Guest",
                credential_verifier=verifier(guest_credential),
            ),
        )

        host_snapshot = await authority.snapshot(
            created.room_code,
            Viewer(credential=host_credential),
        )
        guest_snapshot = await authority.snapshot(
            created.room_code,
            Viewer(credential=guest_credential),
        )

        self.assertEqual(created.room_code, "ABCD")
        self.assertEqual(repeated.room_code, "ABCD")
        self.assertEqual(joined.snapshot.revision, 2)
        self.assertEqual(host_snapshot.revision, guest_snapshot.revision)
        self.assertEqual(host_snapshot.viewer_seat_index, 0)
        self.assertEqual(guest_snapshot.viewer_seat_index, 1)
        self.assertEqual([participant.name for participant in host_snapshot.participants], ["Host", "Guest"])
