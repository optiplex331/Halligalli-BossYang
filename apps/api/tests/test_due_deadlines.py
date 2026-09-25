from __future__ import annotations

import asyncio

from redis.asyncio import Redis

from halligalli_api.authority import (
    ContinueMatch,
    Forfeit,
    Ready,
    RedisMultiplayerAuthority,
    Start,
    Viewer,
)
from redis_test_case import REDIS_URL, FixedDeck, RedisAsyncTestCase


class DueDeadlineTest(RedisAsyncTestCase):
    async def _started(self, room_id: str):
        created, credentials = await self.create_room(
            room_id,
            (("Host", f"{room_id}-host"), ("Guest", f"{room_id}-guest")),
        )
        for credential in credentials:
            await self.authority.execute(created.room_code, Ready(credential))
        started = await self.authority.execute(created.room_code, Start(credentials[0], now_ms=1_000))
        return started, credentials

    async def _fresh_authority(self) -> RedisMultiplayerAuthority:
        redis = Redis.from_url(REDIS_URL, decode_responses=True)
        self.addAsyncCleanup(redis.aclose)
        return RedisMultiplayerAuthority(redis, deck=FixedDeck())

    async def test_a_fresh_authority_advances_an_overdue_turn_and_closes_an_overdue_post_match_window(self) -> None:
        started, credentials = await self._started("restart")
        deadline = started.snapshot.turn_deadline_at

        restarted = await self._fresh_authority()
        self.assertEqual(await restarted.advance_due(deadline - 1), [])
        self.assertEqual(await restarted.advance_due(deadline), [started.room_code])
        advanced = await restarted.snapshot(started.room_code, Viewer("restart-host"))
        self.assertEqual(advanced.last_reveal.sequence, 2)
        self.assertGreater(advanced.turn_deadline_at, deadline)

        finished = await restarted.execute(started.room_code, Forfeit(credentials[1], now_ms=deadline + 100))
        await restarted.execute(started.room_code, ContinueMatch(credentials[0], True))
        post_match_deadline = finished.snapshot.post_match_deadline_at

        restarted_again = await self._fresh_authority()
        self.assertEqual(await restarted_again.advance_due(post_match_deadline), [started.room_code])
        lobby = await restarted_again.snapshot(started.room_code, Viewer("restart-host"))
        self.assertEqual(lobby.phase, "lobby")
        self.assertEqual([participant.name for participant in lobby.participants], ["Host"])

    async def test_concurrent_due_processing_advances_each_deadline_once(self) -> None:
        started, _ = await self._started("race")
        deadline = started.snapshot.turn_deadline_at
        left = await self._fresh_authority()
        right = await self._fresh_authority()

        changed = await asyncio.gather(left.advance_due(deadline), right.advance_due(deadline))
        snapshot = await self.authority.snapshot(started.room_code, Viewer("race-host"))

        self.assertEqual(sorted(changed, key=len), [[], [started.room_code]])
        self.assertEqual(snapshot.revision, started.snapshot.revision + 1)
        self.assertEqual(snapshot.last_reveal.sequence, 2)

    async def test_a_duplicate_post_match_advance_is_a_no_op(self) -> None:
        started, credentials = await self._started("duplicate")
        finished = await self.authority.execute(started.room_code, Forfeit(credentials[1], now_ms=1_100))
        deadline = finished.snapshot.post_match_deadline_at

        self.assertEqual(await self.authority.advance_due(deadline), [started.room_code])
        lobby = await self.authority.snapshot(started.room_code, Viewer("duplicate-host"))
        self.assertEqual(await self.authority.advance_due(deadline + 1_000), [])
        unchanged = await self.authority.snapshot(started.room_code, Viewer("duplicate-host"))

        self.assertEqual(lobby.phase, "lobby")
        self.assertEqual(unchanged.revision, lobby.revision)
