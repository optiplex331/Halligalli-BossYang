from __future__ import annotations

import unittest

from halligalli_api.authority import (
    AdvancePostMatch,
    ContinueMatch,
    Forfeit,
    JoinRoom,
    Leave,
    Ready,
    Start,
)
from redis_test_case import RedisAsyncTestCase, hash_credential


class RoomLifecycleTest(RedisAsyncTestCase):
    async def test_lobby_vacancy_reuses_the_lowest_stable_seat(self) -> None:
        authority = self.authority
        created, credentials = await self.create_room(
            "vacancy",
            (("Host", "host"), ("Guest", "guest")),
        )
        host, guest = credentials
        await authority.execute(created.room_code, Leave(guest, "leave-guest"))
        joined = await authority.execute(
            created.room_code,
            JoinRoom("replacement", "Replacement", hash_credential("replacement")),
        )

        self.assertEqual(joined.snapshot.viewer_seat_index, 1)
        self.assertEqual([(participant.seat_index, participant.active) for participant in joined.snapshot.participants], [(0, True), (1, True)])

    async def test_forfeit_then_continue_creates_a_new_sequential_match_and_deduplicates_commands(self) -> None:
        authority = self.authority
        created, credentials = await self.create_room(
            "sequential",
            (("Host", "host"), ("Guest", "guest"), ("Third", "third")),
        )

        first_ready = await authority.execute(created.room_code, Ready(credentials[0], "ready-host"))
        replayed_ready = await authority.execute(created.room_code, Ready(credentials[0], "ready-host"))
        self.assertEqual(replayed_ready.snapshot.revision, first_ready.snapshot.revision)
        await authority.execute(created.room_code, Ready(credentials[1], "ready-guest"))
        await authority.execute(created.room_code, Ready(credentials[2], "ready-third"))
        await authority.execute(created.room_code, Start(credentials[0], 1_000, "start-one"))
        forfeited = await authority.execute(created.room_code, Forfeit(credentials[2], 1_100, "forfeit-third"))

        self.assertEqual(forfeited.snapshot.phase, "post_match")
        self.assertEqual(forfeited.snapshot.match_number, 1)
        await authority.execute(created.room_code, ContinueMatch(credentials[0], True, "continue-host"))
        continuing = await authority.execute(created.room_code, ContinueMatch(credentials[1], True, "continue-guest"))
        deadline = continuing.snapshot.post_match_deadline_at
        self.assertIsNotNone(deadline)
        lobby = await authority.execute(created.room_code, AdvancePostMatch(deadline or 0, "close-post-match"))

        self.assertEqual(lobby.snapshot.phase, "lobby")
        self.assertEqual([(item.seat_index, item.active) for item in lobby.snapshot.participants], [(0, True), (1, True)])
        replacement = hash_credential("replacement")
        await authority.execute(created.room_code, JoinRoom("join-replacement", "Replacement", replacement))
        await authority.execute(created.room_code, Ready(credentials[0], "ready-host-two"))
        await authority.execute(created.room_code, Ready(credentials[1], "ready-guest-two"))
        await authority.execute(created.room_code, Ready(replacement, "ready-replacement"))
        next_match = await authority.execute(created.room_code, Start(credentials[0], 2_000, "start-two"))
        self.assertEqual(next_match.snapshot.match_number, 2)
