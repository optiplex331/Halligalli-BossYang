from __future__ import annotations

import hashlib
import unittest

from halligalli_api.authority import (
    AdvanceTurn,
    Bell,
    CreateRoom,
    InMemoryMultiplayerAuthority,
    JoinRoom,
    Ready,
    Start,
    TURN_DURATION_MS,
)


def verifier(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


class TableSeatMatrixAuthorityTest(unittest.IsolatedAsyncioTestCase):
    async def _started_room(self, table_seats: int, humans: int):
        code = f"{table_seats}{humans}XY"
        authority = InMemoryMultiplayerAuthority(room_codes=iter([code]))
        credentials = [verifier(f"{code}-{seat}") for seat in range(humans)]
        created = await authority.execute(
            None,
            CreateRoom("create", "Host", credentials[0], table_seats, humans, "normal", 60),
        )
        for seat in range(1, humans):
            await authority.execute(code, JoinRoom(f"join-{seat}", f"P{seat + 1}", credentials[seat]))
        for credential in credentials:
            await authority.execute(code, Ready(credential))
        started = await authority.execute(code, Start(credentials[0], now_ms=1_000))
        return authority, credentials, started

    async def test_all_twenty_five_supported_multiplayer_configurations(self) -> None:
        for table_seats in range(4, 9):
            for humans in range(2, table_seats + 1):
                with self.subTest(table_seats=table_seats, humans=humans):
                    authority, _, started = await self._started_room(table_seats, humans)
                    self.assertEqual(started.snapshot.configuration.table_seat_count, table_seats)
                    self.assertEqual(started.snapshot.configuration.target_human_participant_count, humans)
                    self.assertEqual([seat.seat_index for seat in started.snapshot.seats], list(range(table_seats)))
                    self.assertEqual(len(started.snapshot.participants), humans)
                    self.assertEqual(len(started.snapshot.scoreboard), humans)

                    progressed = started
                    for turn in range(1, table_seats):
                        progressed = await authority.execute(
                            started.room_code,
                            AdvanceTurn(now_ms=1_000 + turn * TURN_DURATION_MS),
                        )
                    self.assertEqual([seat.face_up_card_count for seat in progressed.snapshot.seats], [1] * table_seats)

    async def test_full_face_up_count_drives_collection_and_neutral_seats_never_score(self) -> None:
        authority, credentials, started = await self._started_room(8, 2)
        await authority.execute(started.room_code, AdvanceTurn(now_ms=1_000 + TURN_DURATION_MS))
        result = await authority.execute(started.room_code, Bell(credentials[1], now_ms=1_701))

        self.assertEqual(len(result.snapshot.scoreboard), 2)
        self.assertEqual([score.seat_index for score in result.snapshot.scoreboard], [0, 1])
        self.assertTrue(all(seat.face_up_card_count == 0 for seat in result.snapshot.seats))
