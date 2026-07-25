from __future__ import annotations

import unittest

from halligalli_api.authority import (
    AdvanceTurn,
    Bell,
    Ready,
    Start,
    TURN_DURATION_MS,
)
from redis_test_case import RedisAsyncTestCase


class TableSeatMatrixAuthorityTest(RedisAsyncTestCase):
    async def _started_room(self, table_seats: int, humans: int):
        code = f"{table_seats}{humans}XY"
        authority = self.authority
        created, credentials = await self.create_room(
            code,
            tuple(
                ("Host" if seat == 0 else f"P{seat + 1}", f"{code}-{seat}")
                for seat in range(humans)
            ),
            table_seats=table_seats,
            target_humans=humans,
        )
        for credential in credentials:
            await authority.execute(created.room_code, Ready(credential))
        started = await authority.execute(created.room_code, Start(credentials[0], now_ms=1_000))
        return authority, credentials, started

    async def test_full_face_up_count_drives_collection_and_neutral_seats_never_score(self) -> None:
        authority, credentials, started = await self._started_room(8, 2)
        await authority.execute(started.room_code, AdvanceTurn(now_ms=1_000 + TURN_DURATION_MS))
        result = await authority.execute(started.room_code, Bell(credentials[1], now_ms=1_701))

        self.assertEqual(len(result.snapshot.scoreboard), 2)
        self.assertEqual([score.seat_index for score in result.snapshot.scoreboard], [0, 1])
        self.assertTrue(all(seat.face_up_card_count == 0 for seat in result.snapshot.seats))
