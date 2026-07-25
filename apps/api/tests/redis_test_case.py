from __future__ import annotations

import asyncio
import hashlib
import os
import unittest

from redis.asyncio import Redis

from halligalli_api.authority import AuthorityResult, CreateRoom, JoinRoom, RedisMultiplayerAuthority


REDIS_URL = os.environ.get("HALLIGALLI_TEST_REDIS_URL")


def hash_credential(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


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

    async def create_room(
        self,
        room_id: str,
        participants: tuple[tuple[str, str], ...],
        *,
        table_seats: int = 4,
        target_humans: int | None = None,
    ) -> tuple[AuthorityResult, list[str]]:
        credentials = [hash_credential(credential) for _, credential in participants]
        created = await self.authority.execute(
            None,
            CreateRoom(
                f"create-{room_id}",
                participants[0][0],
                credentials[0],
                table_seats,
                target_humans if target_humans is not None else len(participants),
                "normal",
                60,
            ),
        )
        for index, ((name, _), credential) in enumerate(
            zip(participants[1:], credentials[1:], strict=True),
            start=1,
        ):
            await self.authority.execute(
                created.room_code,
                JoinRoom(f"join-{room_id}-{index}", name, credential),
            )
        return created, credentials


@unittest.skipUnless(REDIS_URL, "set HALLIGALLI_TEST_REDIS_URL to run Redis-backed API tests")
class RedisTestCase(unittest.TestCase):
    def setUp(self) -> None:
        asyncio.run(_flush_redis())
        self.authority = RedisMultiplayerAuthority.from_url(REDIS_URL)
