from __future__ import annotations

from halligalli_api.authority import (
    AdvanceTurn,
    AuthorityError,
    Bell,
    Ready,
    RedisMultiplayerAuthority,
    Start,
    StaleBellResult,
)
from redis_test_case import RedisAsyncTestCase


class TwoCardDeck:
    """A deck whose second reveal opens the last Bell Window, so the winning bell ends the match."""

    def new_seed(self) -> int:
        return 0

    def deal(self, seed: int, table_seat_count: int) -> tuple[tuple[str, int], ...]:
        return (("banana", 2), ("banana", 3))


class StaleBellTest(RedisAsyncTestCase):
    async def _bell_window(self, room_id: str):
        """Start a two-player match and reveal the second card, which opens a banana Bell Window."""
        created, credentials = await self.create_room(room_id, (("Host", f"{room_id}-host"), ("Guest", f"{room_id}-guest")))
        for credential in credentials:
            await self.authority.execute(created.room_code, Ready(credential))
        started = await self.authority.execute(created.room_code, Start(credentials[0], now_ms=1_000))
        opened = await self.authority.execute(created.room_code, AdvanceTurn(now_ms=started.snapshot.turn_deadline_at))
        self.assertEqual((opened.snapshot.last_reveal.sequence, opened.snapshot.bell_fruit), (2, "banana"))
        return created.room_code, credentials, opened

    async def _stored_state(self, room_code: str) -> str:
        return await self.redis.hget(f"halligalli:room:{{{room_code}}}", "state")

    async def test_the_slower_of_two_correct_rings_is_discarded_without_penalty(self) -> None:
        room_code, (host, guest), _ = await self._bell_window("race")
        won = await self.authority.execute(room_code, Bell(host, now_ms=1_800, reveal_sequence=2))
        stored = await self._stored_state(room_code)

        late = await self.authority.execute(room_code, Bell(guest, now_ms=1_810, reveal_sequence=2))

        self.assertEqual(won.snapshot.last_event, "correct_bell")
        self.assertIsInstance(late, StaleBellResult)
        self.assertEqual(late.snapshot.revision, won.snapshot.revision)
        self.assertEqual(late.snapshot.scoreboard, won.snapshot.scoreboard)
        self.assertEqual(await self._stored_state(room_code), stored)

    async def test_a_bell_for_a_transition_resolved_as_missed_is_not_credited_to_the_next_reveal(self) -> None:
        room_code, (host, _), opened = await self._bell_window("missed")
        # The third reveal keeps five bananas on the table, so a new Bell Window opens.
        missed = await self.authority.execute(room_code, AdvanceTurn(now_ms=opened.snapshot.turn_deadline_at))

        late = await self.authority.execute(room_code, Bell(host, now_ms=missed.snapshot.turn_deadline_at - 1, reveal_sequence=2))

        self.assertEqual((missed.snapshot.last_event, missed.snapshot.bell_fruit), ("missed_bell", "banana"))
        self.assertIsInstance(late, StaleBellResult)
        self.assertEqual(late.snapshot.scoreboard[0].correct_hits, 0)

    async def test_a_bell_after_the_match_ending_bell_is_stale(self) -> None:
        self.authority = RedisMultiplayerAuthority(self.redis, deck=TwoCardDeck())
        room_code, (host, guest), _ = await self._bell_window("final")
        finished = await self.authority.execute(room_code, Bell(host, now_ms=1_800, reveal_sequence=2))

        late = await self.authority.execute(room_code, Bell(guest, now_ms=1_810, reveal_sequence=2))

        self.assertEqual(finished.snapshot.phase, "post_match")
        self.assertIsInstance(late, StaleBellResult)
        self.assertEqual(late.snapshot.result, finished.snapshot.result)

    async def test_ringing_at_the_current_transition_without_a_window_keeps_the_wrong_bell_penalty(self) -> None:
        room_code, (host, _), _ = await self._bell_window("wrong")
        won = await self.authority.execute(room_code, Bell(host, now_ms=1_800, reveal_sequence=2))
        quiet = await self.authority.execute(room_code, AdvanceTurn(now_ms=won.snapshot.turn_deadline_at))

        wrong = await self.authority.execute(room_code, Bell(host, now_ms=2_600, reveal_sequence=quiet.snapshot.last_reveal.sequence))

        self.assertIsNone(quiet.snapshot.bell_fruit)
        self.assertEqual(wrong.snapshot.last_event, "wrong_bell")
        self.assertEqual(wrong.snapshot.scoreboard[0].wrong_hits, 1)
        self.assertEqual(wrong.snapshot.revision, quiet.snapshot.revision + 1)

    async def test_a_bell_naming_an_unrevealed_transition_is_an_invalid_request(self) -> None:
        room_code, (host, _), _ = await self._bell_window("future")
        stored = await self._stored_state(room_code)

        with self.assertRaises(AuthorityError) as rejected:
            await self.authority.execute(room_code, Bell(host, now_ms=1_800, reveal_sequence=3))

        self.assertEqual((rejected.exception.code, rejected.exception.status_code), ("invalid_request", 422))
        self.assertEqual(await self._stored_state(room_code), stored)

    async def test_a_replayed_stale_bell_gets_the_same_outcome_and_is_never_cached(self) -> None:
        room_code, (host, guest), _ = await self._bell_window("replay")
        won = await self.authority.execute(room_code, Bell(host, now_ms=1_800, reveal_sequence=2, command_id="host-bell"))
        stored = await self._stored_state(room_code)

        first = await self.authority.execute(room_code, Bell(guest, now_ms=1_810, reveal_sequence=2, command_id="late"))
        retried = await self.authority.execute(room_code, Bell(guest, now_ms=1_810, reveal_sequence=2, command_id="late"))
        replayed_win = await self.authority.execute(room_code, Bell(host, now_ms=1_800, reveal_sequence=2, command_id="host-bell"))

        self.assertIsInstance(first, StaleBellResult)
        self.assertIsInstance(retried, StaleBellResult)
        self.assertEqual(await self._stored_state(room_code), stored)
        self.assertNotIsInstance(replayed_win, StaleBellResult)
        self.assertEqual(replayed_win.snapshot.revision, won.snapshot.revision)
