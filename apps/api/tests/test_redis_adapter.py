from __future__ import annotations

import hashlib
import os
import unittest

from redis.asyncio import Redis

from halligalli_api.authority import (
    AdvanceTurn,
    Bell,
    CreateRoom,
    JoinRoom,
    Ready,
    RedisMultiplayerAuthority,
    Start,
    Viewer,
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

    async def test_redis_runtime_stores_a_six_seat_lobby(self) -> None:
        credentials = [f"player-{seat_index}-credential" for seat_index in range(6)]
        created = await self.authority.execute(
            None,
            CreateRoom("create-1", "Player 1", verifier(credentials[0])),
        )
        for seat_index, credential in enumerate(credentials[1:], start=2):
            await self.authority.execute(
                created.room_code,
                JoinRoom(f"join-{seat_index}", f"Player {seat_index}", verifier(credential)),
            )

        snapshot = await self.authority.snapshot(
            created.room_code,
            Viewer(credentials[-1]),
        )

        self.assertEqual(snapshot.revision, 6)
        self.assertEqual(snapshot.viewer_seat_index, 5)
        self.assertEqual(snapshot.max_participants, 6)
        self.assertEqual([participant.seat_index for participant in snapshot.participants], list(range(6)))

    async def test_redis_runtime_commits_a_six_seat_authoritative_match(self) -> None:
        credentials = [f"player-{seat_index}-credential" for seat_index in range(6)]
        verifiers = [verifier(credential) for credential in credentials]
        created = await self.authority.execute(None, CreateRoom("create-1", "Player 1", verifiers[0]))
        for seat_index, participant_verifier in enumerate(verifiers[1:], start=2):
            await self.authority.execute(
                created.room_code,
                JoinRoom(f"join-{seat_index}", f"Player {seat_index}", participant_verifier),
            )
        for participant_verifier in verifiers:
            await self.authority.execute(created.room_code, Ready(participant_verifier))
        await self.authority.execute(created.room_code, Start(verifiers[0], now_ms=1_000))
        for turn_index in range(1, 6):
            await self.authority.execute(
                created.room_code,
                AdvanceTurn(now_ms=1_000 + turn_index * 700),
            )
        result = await self.authority.execute(created.room_code, Bell(verifiers[-1], now_ms=4_501))

        self.assertEqual(result.snapshot.phase, "playing")
        self.assertIsNone(result.snapshot.result)
        self.assertEqual(result.snapshot.scoreboard[5].score, 231)
