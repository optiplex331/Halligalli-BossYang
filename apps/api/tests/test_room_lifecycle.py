from __future__ import annotations

import unittest

from halligalli_api.authority import (
    COMMAND_HISTORY_LIMIT,
    AdvancePostMatch,
    AdvanceTurn,
    Bell,
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

    async def _started(self, room_id: str, names: tuple[str, ...]):
        created, credentials = await self.create_room(
            room_id,
            tuple((name, f"{room_id}-{name}") for name in names),
        )
        for credential in credentials:
            await self.authority.execute(created.room_code, Ready(credential))
        await self.authority.execute(created.room_code, Start(credentials[0], 1_000))
        return created.room_code, credentials

    async def test_a_three_human_match_continues_after_one_forfeit(self) -> None:
        room_code, credentials = await self._started("three", ("Host", "Guest", "Third"))
        forfeited = await self.authority.execute(room_code, Forfeit(credentials[2], 1_100))
        advanced = await self.authority.execute(room_code, AdvanceTurn(forfeited.snapshot.turn_deadline_at))

        self.assertEqual(forfeited.snapshot.phase, "playing")
        self.assertEqual(forfeited.snapshot.last_event, "forfeit")
        self.assertEqual(forfeited.snapshot.allowed_commands, [])
        self.assertEqual(
            [(score.name, score.forfeited) for score in forfeited.snapshot.scoreboard],
            [("Host", False), ("Guest", False), ("Third", True)],
        )
        self.assertEqual(advanced.snapshot.phase, "playing")
        self.assertEqual(advanced.snapshot.last_reveal.sequence, 2)

    async def test_a_two_human_match_finishes_normally_after_one_forfeit(self) -> None:
        room_code, credentials = await self._started("two", ("Host", "Guest"))
        finished = await self.authority.execute(room_code, Forfeit(credentials[0], 1_100))

        self.assertEqual(finished.snapshot.phase, "post_match")
        self.assertEqual(finished.snapshot.last_event, "forfeit")
        self.assertEqual((finished.snapshot.result.winner_seat_index, finished.snapshot.result.winner_name), (1, "Guest"))
        self.assertEqual(
            [(score.name, score.forfeited) for score in finished.snapshot.result.participants],
            [("Host", True), ("Guest", False)],
        )

    async def test_forfeits_then_continue_create_a_new_sequential_match_and_deduplicate_commands(self) -> None:
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
        await authority.execute(created.room_code, Forfeit(credentials[2], 1_100, "forfeit-third"))
        forfeited = await authority.execute(created.room_code, Forfeit(credentials[1], 1_200, "forfeit-guest"))

        self.assertEqual(forfeited.snapshot.phase, "post_match")
        self.assertEqual(forfeited.snapshot.match_number, 1)
        continuing = await authority.execute(created.room_code, ContinueMatch(credentials[0], True, "continue-host"))
        deadline = continuing.snapshot.post_match_deadline_at
        self.assertIsNotNone(deadline)
        lobby = await authority.execute(created.room_code, AdvancePostMatch(deadline or 0, "close-post-match"))

        self.assertEqual(lobby.snapshot.phase, "lobby")
        self.assertEqual([(item.seat_index, item.active) for item in lobby.snapshot.participants], [(0, True)])
        replacements = [hash_credential("replacement-one"), hash_credential("replacement-two")]
        for index, replacement in enumerate(replacements):
            await authority.execute(created.room_code, JoinRoom(f"join-replacement-{index}", f"Replacement {index}", replacement))
        for index, credential in enumerate([credentials[0], *replacements]):
            await authority.execute(created.room_code, Ready(credential, f"ready-two-{index}"))
        next_match = await authority.execute(created.room_code, Start(credentials[0], 2_000, "start-two"))
        self.assertEqual(next_match.snapshot.match_number, 2)

    async def test_command_history_keeps_only_a_recent_window(self) -> None:
        authority = self.authority
        created, credentials = await self.create_room("history", (("Host", "host"), ("Guest", "guest")))
        for credential in credentials:
            await authority.execute(created.room_code, Ready(credential))
        await authority.execute(created.room_code, Start(credentials[0], 1_000))
        for index in range(COMMAND_HISTORY_LIMIT + 5):
            latest = await authority.execute(created.room_code, Bell(credentials[0], 1_001, f"bell-{index}"))

        replayed = await authority.execute(created.room_code, Bell(credentials[0], 1_001, f"bell-{COMMAND_HISTORY_LIMIT + 4}"))
        forgotten = await authority.execute(created.room_code, Bell(credentials[0], 1_001, "bell-0"))

        self.assertEqual(replayed.snapshot.revision, latest.snapshot.revision)
        self.assertEqual(forgotten.snapshot.revision, latest.snapshot.revision + 1)
