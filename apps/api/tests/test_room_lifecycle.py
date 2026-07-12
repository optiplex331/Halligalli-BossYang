from __future__ import annotations

import hashlib
import unittest

from halligalli_api.authority import (
    AdvancePostMatch,
    ContinueMatch,
    CreateRoom,
    Forfeit,
    InMemoryMultiplayerAuthority,
    JoinRoom,
    Leave,
    Ready,
    Start,
)


def verifier(credential: str) -> str:
    return hashlib.sha256(credential.encode()).hexdigest()


class RoomLifecycleTest(unittest.IsolatedAsyncioTestCase):
    async def test_lobby_vacancy_reuses_the_lowest_stable_seat(self) -> None:
        authority = InMemoryMultiplayerAuthority(room_codes=iter(["LIFE"]))
        host, guest, replacement = (verifier(value) for value in ("host", "guest", "replacement"))
        created = await authority.execute(None, CreateRoom("create", "Host", host))
        await authority.execute(created.room_code, JoinRoom("guest", "Guest", guest))
        await authority.execute(created.room_code, Leave(guest, "leave-guest"))
        joined = await authority.execute(created.room_code, JoinRoom("replacement", "Replacement", replacement))

        self.assertEqual(joined.snapshot.viewer_seat_index, 1)
        self.assertEqual([(participant.seat_index, participant.active) for participant in joined.snapshot.participants], [(0, True), (1, True)])

    async def test_forfeit_then_continue_creates_a_new_sequential_match_and_deduplicates_commands(self) -> None:
        authority = InMemoryMultiplayerAuthority(room_codes=iter(["NEXT"]))
        credentials = [verifier(value) for value in ("host", "guest", "third")]
        created = await authority.execute(None, CreateRoom("create", "Host", credentials[0]))
        await authority.execute(created.room_code, JoinRoom("join-guest", "Guest", credentials[1]))
        await authority.execute(created.room_code, JoinRoom("join-third", "Third", credentials[2]))

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
        await authority.execute(created.room_code, Ready(credentials[0], "ready-host-two"))
        await authority.execute(created.room_code, Ready(credentials[1], "ready-guest-two"))
        next_match = await authority.execute(created.room_code, Start(credentials[0], 2_000, "start-two"))
        self.assertEqual(next_match.snapshot.match_number, 2)
