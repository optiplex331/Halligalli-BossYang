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
        self.assertEqual(completed.snapshot.phase, "playing")
        self.assertIsNone(completed.snapshot.result)
        self.assertEqual(completed.snapshot.current_turn, 0)
        self.assertEqual(completed.snapshot.top_cards, [None, None])
        self.assertEqual(completed.snapshot.scoreboard[0].score, 207)
        self.assertEqual(completed.snapshot.revision, 7)

    async def test_wrong_and_missed_windows_keep_applied_penalties_at_the_floor(self) -> None:
        authority = InMemoryMultiplayerAuthority(room_codes=iter(["WXYZ"]))
        host = verifier("host-credential")
        guest = verifier("guest-credential")
        created = await authority.execute(None, CreateRoom("create-2", "Host", host))
        await authority.execute(created.room_code, JoinRoom("join-2", "Guest", guest))
        await authority.execute(created.room_code, Ready(host))
        await authority.execute(created.room_code, Ready(guest))
        await authority.execute(created.room_code, Start(host, now_ms=1_000))

        wrong = await authority.execute(created.room_code, Bell(host, now_ms=1_001))
        await authority.execute(created.room_code, AdvanceTurn(now_ms=2_000))
        missed = await authority.execute(created.room_code, AdvanceTurn(now_ms=2_700))

        self.assertEqual(wrong.snapshot.last_event, "wrong_bell")
        self.assertEqual(wrong.snapshot.scoreboard[0].score, 0)
        self.assertEqual(wrong.snapshot.scoreboard[0].score_breakdown.wrong_penalty, 0)
        self.assertEqual(missed.snapshot.phase, "playing")
        self.assertEqual(missed.snapshot.last_event, "missed_bell")
        self.assertEqual(missed.snapshot.top_cards[0].fruit, "strawberry")
        self.assertEqual([item.score for item in missed.snapshot.scoreboard], [0, 0])
        self.assertEqual([item.score_breakdown.missed_penalty for item in missed.snapshot.scoreboard], [0, 0])
