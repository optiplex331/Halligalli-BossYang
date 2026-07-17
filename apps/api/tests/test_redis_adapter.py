from __future__ import annotations

import hashlib
import os
import unittest
import asyncio

from redis.asyncio import Redis

from halligalli_api.authority import (
    CreateRoom,
    JoinRoom,
    Ready,
    RedisMultiplayerAuthority,
)


def verifier(credential: str) -> str:
    return hashlib.sha256(credential.encode()).hexdigest()


@unittest.skipUnless(
    os.environ.get("HALLIGALLI_TEST_REDIS_URL"),
    "set HALLIGALLI_TEST_REDIS_URL to run the Redis adapter contract",
)
class RedisAdapterTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.redis = Redis.from_url(os.environ["HALLIGALLI_TEST_REDIS_URL"], decode_responses=True)
        await self.redis.flushdb()
        self.authority = RedisMultiplayerAuthority(self.redis)

    async def asyncTearDown(self) -> None:
        await self.redis.aclose()

    async def test_redis_serializes_concurrent_commands_and_replays_a_command_id(self) -> None:
        host, guest = "host-credential", "guest-credential"
        created = await self.authority.execute(None, CreateRoom("create-race", "Host", verifier(host), 4, 2, "normal", 60))
        await self.authority.execute(created.room_code, JoinRoom("join-race", "Guest", verifier(guest)))
        left = RedisMultiplayerAuthority(self.redis)
        right = RedisMultiplayerAuthority(self.redis)
        first, second = await asyncio.gather(
            left.execute(created.room_code, Ready(verifier(host), "ready-host")),
            right.execute(created.room_code, Ready(verifier(guest), "ready-guest")),
        )
        replay = await self.authority.execute(created.room_code, Ready(verifier(host), "ready-host"))

        self.assertEqual(sorted((first.snapshot.revision, second.snapshot.revision)), [3, 4])
        self.assertEqual(replay.snapshot.revision, 4)

    async def test_redis_publishes_room_revision_hints(self) -> None:
        host, guest = "host-credential", "guest-credential"
        created = await self.authority.execute(None, CreateRoom("create-pubsub", "Host", verifier(host), 4, 2, "normal", 60))
        subscription = await self.authority.subscribe_revisions()
        try:
            revision = asyncio.create_task(anext(subscription.events()))
            await self.authority.execute(created.room_code, JoinRoom("join-pubsub", "Guest", verifier(guest)))
            self.assertEqual(await asyncio.wait_for(revision, timeout=1), created.room_code)
        finally:
            await subscription.aclose()
