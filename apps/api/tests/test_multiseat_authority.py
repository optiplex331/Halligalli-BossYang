from __future__ import annotations

import hashlib
import json
import unittest
from collections import Counter
from pathlib import Path

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


def verifier(credential: str) -> str:
    return hashlib.sha256(credential.encode()).hexdigest()


FIXTURE = json.loads(
    (Path(__file__).parents[3] / "contracts" / "fixtures" / "v1" / "single-player.json").read_text(),
)


def capacity_cases() -> list[dict[str, object]]:
    return [case for case in FIXTURE["cases"] if case["kind"] == "multiplayer-capacity"]


def fixture_case(case_id: str) -> dict[str, object]:
    return next(case for case in FIXTURE["cases"] if case["id"] == case_id)


class MultiplayerCapacityAuthorityTest(unittest.IsolatedAsyncioTestCase):
    async def test_each_supported_occupied_seat_count_uses_the_same_match_flow(self) -> None:
        authority = InMemoryMultiplayerAuthority(
            room_codes=iter(["M002", "M003", "M004", "M005", "M006"]),
        )

        for case in capacity_cases():
            participant_count = int(case["participants"])
            expected = case["expected"]
            verifiers = [verifier(f"player-{participant_count}-{seat_index}") for seat_index in range(participant_count)]
            created = await authority.execute(
                None,
                CreateRoom(f"create-{participant_count}", "Player 1", verifiers[0]),
            )
            for seat_index, participant_verifier in enumerate(verifiers[1:], start=2):
                await authority.execute(
                    created.room_code,
                    JoinRoom(
                        f"join-{participant_count}-{seat_index}",
                        f"Player {seat_index}",
                        participant_verifier,
                    ),
                )

            for participant_verifier in verifiers:
                await authority.execute(created.room_code, Ready(participant_verifier))

            started = await authority.execute(
                created.room_code,
                Start(verifiers[0], now_ms=1_000),
            )
            progressed = started
            for turn_index in range(1, participant_count):
                progressed = await authority.execute(
                    created.room_code,
                    AdvanceTurn(now_ms=1_000 + turn_index * TURN_DURATION_MS),
                )
            continued = await authority.execute(
                created.room_code,
                Bell(
                    verifiers[-1],
                    now_ms=1_000
                    + (participant_count - 1) * TURN_DURATION_MS
                    + int(case["reactionMs"]),
                ),
            )

            self.assertEqual(started.snapshot.max_participants, expected["maxParticipants"])
            self.assertEqual(
                [participant.seat_index for participant in started.snapshot.participants],
                list(range(participant_count)),
            )
            self.assertEqual(len(started.snapshot.top_cards), participant_count)
            self.assertEqual(
                [seat_index for seat_index, card in enumerate(progressed.snapshot.top_cards) if card is not None],
                expected["topCardSeatIndexes"],
            )
            self.assertEqual(progressed.snapshot.current_turn, expected["currentTurn"])
            ringing_seat_index = int(expected["ringingSeatIndex"])
            self.assertEqual(continued.snapshot.phase, "playing")
            self.assertIsNone(continued.snapshot.result)
            self.assertEqual(continued.snapshot.current_turn, ringing_seat_index)
            self.assertEqual(continued.snapshot.top_cards, [None] * participant_count)
            self.assertEqual(continued.snapshot.scoreboard[ringing_seat_index].score, expected["score"])
            self.assertEqual(
                [score.missed_hits for score in continued.snapshot.scoreboard],
                [expected["missedHits"]] * participant_count,
            )
            self.assertEqual(
                continued.snapshot.scoreboard[ringing_seat_index].score_breakdown.model_dump(by_alias=True),
                {
                    **expected["breakdown"],
                    "wrongPenalty": 0,
                    "missedPenalty": 0,
                    "cardPenalty": 0,
                },
            )
            next_turn = await authority.execute(
                created.room_code,
                AdvanceTurn(now_ms=continued.snapshot.turn_deadline_at),
            )
            self.assertIsNotNone(next_turn.snapshot.top_cards[ringing_seat_index])
            self.assertEqual(
                next_turn.snapshot.current_turn,
                (ringing_seat_index + 1) % participant_count,
            )

    async def test_correct_bell_continues_through_the_full_shared_inventory(self) -> None:
        case = fixture_case("multiplayer-full-deck-clockwise")
        expected = case["expected"]
        participant_count = int(case["participants"])
        authority = InMemoryMultiplayerAuthority(room_codes=iter(["D072"]))
        verifiers = [verifier(f"deck-player-{seat_index}") for seat_index in range(participant_count)]
        created = await authority.execute(
            None,
            CreateRoom("create-deck", "Player 1", verifiers[0]),
        )
        for seat_index, participant_verifier in enumerate(verifiers[1:], start=2):
            await authority.execute(
                created.room_code,
                JoinRoom(f"join-deck-{seat_index}", f"Player {seat_index}", participant_verifier),
            )
        for participant_verifier in verifiers:
            await authority.execute(created.room_code, Ready(participant_verifier))

        snapshot = (await authority.execute(created.room_code, Start(verifiers[0], now_ms=1_000))).snapshot
        cards = [snapshot.top_cards[0]]
        turns = [0]
        for turn_index in range(1, participant_count):
            snapshot = (
                await authority.execute(
                    created.room_code,
                    AdvanceTurn(now_ms=1_000 + turn_index * TURN_DURATION_MS),
                )
            ).snapshot
            actor_seat_index = (snapshot.current_turn - 1) % participant_count
            cards.append(snapshot.top_cards[actor_seat_index])
            turns.append(actor_seat_index)

        continued = await authority.execute(
            created.room_code,
            Bell(verifiers[-1], now_ms=1_000 + (participant_count - 1) * TURN_DURATION_MS + 1),
        )
        self.assertEqual(continued.snapshot.phase, "playing")
        self.assertEqual(continued.snapshot.current_turn, participant_count - 1)
        self.assertEqual(continued.snapshot.top_cards, [None] * participant_count)

        for turn_index in range(participant_count, int(expected["cardCount"])):
            snapshot = (
                await authority.execute(
                    created.room_code,
                    AdvanceTurn(now_ms=1_000 + turn_index * TURN_DURATION_MS),
                )
            ).snapshot
            actor_seat_index = (snapshot.current_turn - 1) % participant_count
            cards.append(snapshot.top_cards[actor_seat_index])
            turns.append(actor_seat_index)

        self.assertEqual(len(cards), expected["cardCount"])
        self.assertTrue(all(cards))
        self.assertEqual(
            [{"fruit": card.fruit, "count": card.count} for card in cards[:2]],
            expected["firstCards"],
        )
        self.assertEqual(turns[:participant_count], list(range(participant_count)))
        self.assertEqual(
            turns[participant_count:],
            [
                (participant_count - 1 + turn_index - participant_count) % participant_count
                for turn_index in range(participant_count, len(cards))
            ],
        )
        inventory = Counter((card.fruit, card.count) for card in cards)
        for fruit in ("banana", "strawberry", "lemon", "grape"):
            for count, repetitions in expected["distribution"]:
                self.assertEqual(inventory[(fruit, count)], repetitions)

        completed = await authority.execute(
            created.room_code,
            AdvanceTurn(now_ms=1_000 + int(expected["cardCount"]) * TURN_DURATION_MS),
        )
        self.assertEqual(completed.snapshot.phase, "post_match")
        self.assertEqual(completed.snapshot.result.participants, completed.snapshot.scoreboard)
        self.assertEqual(
            completed.snapshot.result.score,
            completed.snapshot.scoreboard[completed.snapshot.result.winner_seat_index].score,
        )

    async def test_full_inventory_rotates_clockwise_for_each_supported_capacity(self) -> None:
        case = fixture_case("multiplayer-full-deck-clockwise")
        expected = case["expected"]
        authority = InMemoryMultiplayerAuthority(
            room_codes=iter(["F002", "F003", "F004", "F005", "F006"]),
        )

        for participant_count in range(2, 7):
            verifiers = [verifier(f"full-deck-{participant_count}-{seat_index}") for seat_index in range(participant_count)]
            created = await authority.execute(
                None,
                CreateRoom(f"create-full-deck-{participant_count}", "Player 1", verifiers[0]),
            )
            for seat_index, participant_verifier in enumerate(verifiers[1:], start=2):
                await authority.execute(
                    created.room_code,
                    JoinRoom(
                        f"join-full-deck-{participant_count}-{seat_index}",
                        f"Player {seat_index}",
                        participant_verifier,
                    ),
                )
            for participant_verifier in verifiers:
                await authority.execute(created.room_code, Ready(participant_verifier))

            snapshot = (await authority.execute(created.room_code, Start(verifiers[0], now_ms=1_000))).snapshot
            cards = [snapshot.top_cards[0]]
            turns = [0]
            for turn_index in range(1, int(expected["cardCount"])):
                snapshot = (
                    await authority.execute(
                        created.room_code,
                        AdvanceTurn(now_ms=1_000 + turn_index * TURN_DURATION_MS),
                    )
                ).snapshot
                actor_seat_index = (snapshot.current_turn - 1) % participant_count
                cards.append(snapshot.top_cards[actor_seat_index])
                turns.append(actor_seat_index)

            self.assertTrue(all(cards))
            self.assertEqual(len(cards), expected["cardCount"])
            self.assertEqual(turns, [turn_index % participant_count for turn_index in range(len(cards))])
            inventory = Counter((card.fruit, card.count) for card in cards)
            for fruit in ("banana", "strawberry", "lemon", "grape"):
                for count, repetitions in expected["distribution"]:
                    self.assertEqual(inventory[(fruit, count)], repetitions)

            completed = await authority.execute(
                created.room_code,
                AdvanceTurn(now_ms=1_000 + int(expected["cardCount"]) * TURN_DURATION_MS),
            )
            self.assertEqual(completed.snapshot.phase, "post_match")
            self.assertEqual(completed.snapshot.result.participants, completed.snapshot.scoreboard)
