from __future__ import annotations

import hashlib
import os
import unittest

from redis.asyncio import Redis

from halligalli_api.authority import CreateRoom, JoinRoom, RedisMultiplayerAuthority, Viewer


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

    async def test_redis_runtime_stores_two_participant_lobby(self) -> None:
        host_credential = "host-credential"
        guest_credential = "guest-credential"
        created = await self.authority.execute(
            None,
            CreateRoom("create-1", "Host", verifier(host_credential)),
        )
        await self.authority.execute(
            created.room_code,
            JoinRoom("join-1", "Guest", verifier(guest_credential)),
        )

        snapshot = await self.authority.snapshot(
            created.room_code,
            Viewer(guest_credential),
        )

        self.assertEqual(snapshot.revision, 2)
        self.assertEqual(snapshot.viewer_seat_index, 1)
        self.assertEqual(len(snapshot.participants), 2)
