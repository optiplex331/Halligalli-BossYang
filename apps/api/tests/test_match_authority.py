from __future__ import annotations

import hashlib
import unittest

from halligalli_api.authority import (
    AdvanceTurn,
    Bell,
    CreateRoom,
    InMemoryMultiplayerAuthority,
    JoinRoom,
    Ready,
    Start,
)


def verifier(credential: str) -> str:
    return hashlib.sha256(credential.encode()).hexdigest()


class TwoSeatMatchAuthorityTest(unittest.IsolatedAsyncioTestCase):
    async def test_authority_progresses_two_ready_players_to_a_valid_bell_result(self) -> None:
        authority = InMemoryMultiplayerAuthority(room_codes=iter(["ABCD"]))
        host = verifier("host-credential")
        guest = verifier("guest-credential")
        created = await authority.execute(None, CreateRoom("create-1", "Host", host))
        await authority.execute(created.room_code, JoinRoom("join-1", "Guest", guest))

        await authority.execute(created.room_code, Ready(host))
        await authority.execute(created.room_code, Ready(guest))
        started = await authority.execute(created.room_code, Start(host, now_ms=1_000))
        progressed = await authority.execute(created.room_code, AdvanceTurn(now_ms=2_000))
        completed = await authority.execute(created.room_code, Bell(host, now_ms=2_001))

        self.assertEqual(started.snapshot.phase, "playing")
        self.assertEqual(started.snapshot.top_cards[0].count, 2)
        self.assertEqual(progressed.snapshot.bell_fruit, "banana")
        self.assertEqual(progressed.snapshot.top_cards[1].count, 3)
        self.assertEqual(completed.snapshot.phase, "post_match")
        self.assertEqual(completed.snapshot.result.winner_seat_index, 0)
        self.assertEqual(completed.snapshot.result.score, 132)
        self.assertEqual(completed.snapshot.revision, 7)
