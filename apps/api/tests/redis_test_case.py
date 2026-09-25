from __future__ import annotations

import asyncio
import hashlib
import os
import unittest

from redis.asyncio import Redis

from halligalli_api.authority import AuthorityResult, CreateRoom, JoinRoom, RedisMultiplayerAuthority


REDIS_URL = os.environ.get("HALLIGALLI_TEST_REDIS_URL")

FRUITS = ("banana", "strawberry", "lemon", "grape")
DISTRIBUTION = ((1, 3), (2, 5), (3, 5), (4, 3), (5, 2))
OPENING_CARDS = (
    ("banana", 2),
    ("banana", 3),
    ("strawberry", 1),
    ("lemon", 1),
    ("grape", 1),
    ("strawberry", 1),
)


def _fixed_card_order() -> tuple[tuple[str, int], ...]:
    remaining = {(fruit, count): repetitions for fruit in FRUITS for count, repetitions in DISTRIBUTION}
    for card in OPENING_CARDS:
        remaining[card] -= 1
    rest = [(fruit, count) for fruit in FRUITS for count, _ in DISTRIBUTION for _ in range(remaining[(fruit, count)])]
    return OPENING_CARDS + tuple(rest)


FIXED_CARD_ORDER = _fixed_card_order()


class FixedDeck:
    """Deals the same known card order for every match so tests can predict reveals."""

    def new_seed(self) -> int:
        return 0

    def deal(self, seed: int, table_seat_count: int) -> tuple[tuple[str, int], ...]:
        return FIXED_CARD_ORDER


class ManualClock:
    """A millisecond clock that only moves when a test moves it."""

    def __init__(self, now_ms: int = 1_000) -> None:
        self.now_ms = now_ms

    def __call__(self) -> int:
        return self.now_ms


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
        self.authority = RedisMultiplayerAuthority(self.redis, deck=FixedDeck())

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
        self.clock = ManualClock()
        self.authority = RedisMultiplayerAuthority.from_url(REDIS_URL, deck=FixedDeck(), clock=self.clock)
