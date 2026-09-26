from __future__ import annotations

import asyncio

from redis.asyncio import Redis
from redis.exceptions import ResponseError

from halligalli_api.authority import (
    AuthorityError,
    Bell,
    ContinueMatch,
    CreateRoom,
    Forfeit,
    MEMORY_ADMISSION_RATIO,
    Ready,
    RedisMultiplayerAuthority,
    Start,
    Viewer,
)
from redis_test_case import REDIS_URL, FixedDeck, RedisAsyncTestCase, hash_credential


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

    async def test_a_room_that_cannot_advance_is_logged_and_does_not_stall_other_rooms(self) -> None:
        started, _ = await self._started("healthy")
        await self.redis.hset("halligalli:room:{BAD1}", mapping={"state": '{"code":"BAD1"}'})
        await self.redis.zadd("halligalli:rooms:due", {"BAD1": 1})
        deadline = started.snapshot.turn_deadline_at

        with self.assertLogs("halligalli.authority", level="ERROR") as logged:
            changed = await self.authority.advance_due(deadline)
        later = await self.authority.advance_due(deadline + 10_000)

        self.assertEqual(changed, [started.room_code])
        self.assertIn("BAD1", logged.output[0])
        self.assertEqual(later, [started.room_code])

    async def test_a_full_redis_rejects_new_work_as_temporary_and_the_due_loop_retries(self) -> None:
        started, credentials = await self._started("full")
        deadline = started.snapshot.turn_deadline_at
        try:
            original = (await self.redis.config_get("maxmemory"))["maxmemory"]
            await self.redis.config_set("maxmemory", 1)
        except ResponseError as error:
            self.skipTest(f"test Redis does not allow CONFIG SET: {error}")
        try:
            for room_code, command in (
                (None, CreateRoom("create-full-2", "Late", hash_credential("late"), 4, 2, "normal")),
                (started.room_code, Bell(credentials[0], now_ms=deadline - 1)),
            ):
                with self.assertRaises(AuthorityError) as raised:
                    await self.authority.execute(room_code, command)
                self.assertEqual((raised.exception.status_code, raised.exception.code), (503, "capacity_exhausted"))

            with self.assertLogs("halligalli.authority", level="WARNING"):
                self.assertEqual(await self.authority.advance_due(deadline), [])
            self.assertIsNotNone(await self.redis.zscore("halligalli:rooms:due", started.room_code))
        finally:
            await self.redis.config_set("maxmemory", original)

        self.assertEqual(await self.authority.advance_due(deadline), [started.room_code])

    async def test_near_full_redis_refuses_new_rooms_while_running_rooms_keep_advancing(self) -> None:
        started, _ = await self._started("near-full")
        deadline = started.snapshot.turn_deadline_at
        used = (await self.redis.info("memory"))["used_memory"]
        try:
            original = (await self.redis.config_get("maxmemory"))["maxmemory"]
            # Above current use so writes still fit, but at the admission threshold.
            await self.redis.config_set("maxmemory", int(used / MEMORY_ADMISSION_RATIO))
        except ResponseError as error:
            self.skipTest(f"test Redis does not allow CONFIG SET: {error}")
        try:
            with self.assertRaises(AuthorityError) as raised:
                await (await self._fresh_authority()).execute(
                    None,
                    CreateRoom("create-near-full-2", "Late", hash_credential("late"), 4, 2, "normal"),
                )
            self.assertEqual((raised.exception.status_code, raised.exception.code), (503, "capacity_exhausted"))
            self.assertEqual(await self.authority.advance_due(deadline), [started.room_code])
        finally:
            await self.redis.config_set("maxmemory", original)
