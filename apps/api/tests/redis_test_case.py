from __future__ import annotations

import asyncio
import os
import unittest

from redis.asyncio import Redis

from halligalli_api.authority import RedisMultiplayerAuthority


REDIS_URL = os.environ.get("HALLIGALLI_TEST_REDIS_URL")


async def _flush_redis() -> None:
    if REDIS_URL is None:
        return
    redis = Redis.from_url(REDIS_URL, decode_responses=True)
    try:
        await redis.flushdb()
    finally:
        await redis.aclose()


@unittest.skipUnless(REDIS_URL, "set HALLIGALLI_TEST_REDIS_URL to run Redis-backed API tests")
class RedisAsyncTestCase(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.redis = Redis.from_url(REDIS_URL, decode_responses=True)
        await self.redis.flushdb()
        self.authority = RedisMultiplayerAuthority(self.redis)

    async def asyncTearDown(self) -> None:
        await self.redis.aclose()


@unittest.skipUnless(REDIS_URL, "set HALLIGALLI_TEST_REDIS_URL to run Redis-backed API tests")
class RedisTestCase(unittest.TestCase):
    def setUp(self) -> None:
        asyncio.run(_flush_redis())
        self.authority = RedisMultiplayerAuthority.from_url(REDIS_URL)
