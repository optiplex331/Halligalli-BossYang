from __future__ import annotations

import asyncio

from halligalli_api.authority import (
    JoinRoom,
    Ready,
    RedisMultiplayerAuthority,
)
from redis_test_case import RedisAsyncTestCase, hash_credential


class RedisAdapterTest(RedisAsyncTestCase):

    async def test_redis_serializes_concurrent_commands_and_replays_a_command_id(self) -> None:
        created, credentials = await self.create_room(
            "race",
            (("Host", "host-credential"), ("Guest", "guest-credential")),
        )
        host, guest = credentials
        left = RedisMultiplayerAuthority(self.redis)
        right = RedisMultiplayerAuthority(self.redis)
        first, second = await asyncio.gather(
            left.execute(created.room_code, Ready(host, "ready-host")),
            right.execute(created.room_code, Ready(guest, "ready-guest")),
        )
        replay = await self.authority.execute(created.room_code, Ready(host, "ready-host"))

        self.assertEqual(sorted((first.snapshot.revision, second.snapshot.revision)), [3, 4])
        self.assertEqual(replay.snapshot.revision, 4)

    async def test_redis_publishes_room_revision_hints(self) -> None:
        created, _ = await self.create_room(
            "pubsub",
            (("Host", "host-credential"),),
            target_humans=2,
        )
        subscription = await self.authority.subscribe_revisions()
        try:
            revision = asyncio.create_task(anext(subscription.events()))
            await self.authority.execute(
                created.room_code,
                JoinRoom("join-pubsub", "Guest", hash_credential("guest-credential")),
            )
            self.assertEqual(await asyncio.wait_for(revision, timeout=1), created.room_code)
        finally:
            await subscription.aclose()
