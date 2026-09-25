from __future__ import annotations

import unittest

from halligalli_api.authority import (
    AdvanceTurn,
    Bell,
    Ready,
    Start,
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

    async def test_difficulty_sets_the_turn_interval_and_bell_window(self) -> None:
        paces = {}
        for difficulty in ("easy", "normal", "hard"):
            created, credentials = await self.create_room(
                f"pace-{difficulty}",
                (("Host", f"{difficulty}-host"), ("Guest", f"{difficulty}-guest")),
                difficulty=difficulty,
            )
            for credential in credentials:
                await self.authority.execute(created.room_code, Ready(credential))
            quiet = await self.authority.execute(created.room_code, Start(credentials[0], now_ms=10_000))
            deadline = quiet.snapshot.turn_deadline_at
            bell = await self.authority.execute(created.room_code, AdvanceTurn(now_ms=deadline))
            self.assertEqual(quiet.snapshot.bell_fruit, None)
            self.assertEqual(bell.snapshot.bell_fruit, "banana")
            paces[difficulty] = (deadline - 10_000, bell.snapshot.turn_deadline_at - deadline)

        self.assertEqual(paces, {"easy": (900, 1_800), "normal": (700, 1_500), "hard": (550, 1_200)})

    async def test_full_face_up_count_drives_collection_and_neutral_seats_never_score(self) -> None:
        authority, credentials, started = await self._started_room(8, 2)
        await authority.execute(started.room_code, AdvanceTurn(now_ms=started.snapshot.turn_deadline_at))
        result = await authority.execute(started.room_code, Bell(credentials[1], now_ms=1_701))

        self.assertEqual(len(result.snapshot.scoreboard), 2)
        self.assertEqual([score.seat_index for score in result.snapshot.scoreboard], [0, 1])
        self.assertTrue(all(seat.face_up_card_count == 0 for seat in result.snapshot.seats))
