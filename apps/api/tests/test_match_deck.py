from __future__ import annotations

import itertools

from halligalli_api.authority import (
    AdvanceTurn,
    Forfeit,
    Ready,
    RedisMultiplayerAuthority,
    Start,
    StandardDeck,
)
from redis_test_case import RedisAsyncTestCase


class MatchDeckTest(RedisAsyncTestCase):
    async def _reveal(
        self,
        authority: RedisMultiplayerAuthority,
        room_id: str,
        count: int,
        *,
        table_seats: int = 4,
    ) -> tuple[list[tuple[str, int]], list[bool]]:
        self.authority = authority
        created, credentials = await self.create_room(
            room_id,
            (("Host", f"{room_id}-host"), ("Guest", f"{room_id}-guest")),
            table_seats=table_seats,
        )
        for credential in credentials:
            await authority.execute(created.room_code, Ready(credential))
        snapshot = (await authority.execute(created.room_code, Start(credentials[0], now_ms=1_000))).snapshot
        cards: list[tuple[str, int]] = []
        bell_open: list[bool] = []
        while True:
            card = snapshot.seats[snapshot.last_reveal.seat_index].top_card
            cards.append((card.fruit, card.count))
            bell_open.append(snapshot.bell_fruit is not None)
            if len(cards) == count:
                return cards, bell_open
            snapshot = (
                await authority.execute(created.room_code, AdvanceTurn(now_ms=snapshot.turn_deadline_at))
            ).snapshot

    def _authority(self, seeds: list[int]) -> RedisMultiplayerAuthority:
        return RedisMultiplayerAuthority(self.redis, deck=StandardDeck(seed_source=iter(seeds).__next__))

    async def test_the_same_seed_deals_the_same_order_and_different_seeds_differ(self) -> None:
        first, _ = await self._reveal(self._authority([11]), "seed-a", 24)
        replay, _ = await self._reveal(self._authority([11]), "seed-b", 24)
        other, _ = await self._reveal(self._authority([12]), "seed-c", 24)

        self.assertEqual(first, replay)
        self.assertNotEqual(first, other)

    async def test_every_shuffled_deck_opens_an_exact_five_bell_within_eight_reveals(self) -> None:
        seeds = list(range(25))
        for table_seats, seed in itertools.product((4, 8), seeds):
            _, bell_open = await self._reveal(
                self._authority([seed]),
                f"early-{table_seats}-{seed}",
                8,
                table_seats=table_seats,
            )
            self.assertTrue(any(bell_open), f"seed {seed} on {table_seats} seats has no early bell")

    async def test_match_finish_time_comes_from_the_finishing_command_not_the_wall_clock(self) -> None:
        created, credentials = await self.create_room("clock", (("Host", "clock-host"), ("Guest", "clock-guest")))
        for credential in credentials:
            await self.authority.execute(created.room_code, Ready(credential))
        await self.authority.execute(created.room_code, Start(credentials[0], now_ms=60_000))
        finished = await self.authority.execute(created.room_code, Forfeit(credentials[1], now_ms=61_000))

        self.assertEqual(finished.snapshot.phase, "post_match")
        self.assertEqual(finished.snapshot.post_match_deadline_at, 61_000 + 30_000)
