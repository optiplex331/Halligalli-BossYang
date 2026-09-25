from __future__ import annotations

import json
import unittest
from pathlib import Path

from halligalli_api.authority import (
    AdvanceTurn,
    Bell,
    Ready,
    ScoreBreakdown,
    Start,
    apply_scoring_penalty,
    sum_breakdown,
)
from redis_test_case import RedisAsyncTestCase


FIXTURE = json.loads(
    (Path(__file__).parents[3] / "contracts" / "fixtures" / "v1" / "single-player.json").read_text(),
)


# Card penalties intentionally differ by mode: the Multiplayer Authority assesses
# the full ceil(tableCards / 2) target as score only, while Single-Player moves real
# cards and caps the count by the human's hand. See "wrong-bell-card-penalty-policy".
def fixture_case(case_id: str) -> dict[str, object]:
    return next(case for case in FIXTURE["cases"] if case["id"] == case_id)


class SharedScoringFixtureTest(unittest.TestCase):
    def test_penalty_fixtures_apply_the_same_transition_floor(self) -> None:
        for case_id in ("partial-wrong-penalty", "two-seat-wrong-floor", "two-seat-missed-floor"):
            case = fixture_case(case_id)
            assessed = case["assessed"]
            expected = case["expected"]
            breakdown = apply_scoring_penalty(
                ScoreBreakdown(correct_base=int(case.get("startingScore", 0))),
                wrong_penalty=int(assessed.get("wrongPenalty", 0)),
                card_penalty=int(assessed.get("cardPenalty", 0)),
                missed_penalty=int(assessed.get("missedPenalty", 0)),
            )

            self.assertEqual(sum_breakdown(breakdown), expected["score"])
            self.assertEqual(breakdown.wrong_penalty, expected.get("wrongPenalty", 0))
            self.assertEqual(breakdown.card_penalty, expected.get("cardPenalty", 0))
            self.assertEqual(breakdown.missed_penalty, expected.get("missedPenalty", 0))


class SharedCorrectBellFixtureTest(RedisAsyncTestCase):
    async def test_authority_consumes_the_two_seat_correct_bell_vector(self) -> None:
        case = fixture_case("two-seat-correct-bell")
        expected = case["expected"]
        authority = self.authority
        created, credentials = await self.create_room(
            "correct-bell",
            (("Host", "host-credential"), ("Guest", "guest-credential")),
        )
        host, guest = credentials
        await authority.execute(created.room_code, Ready(host))
        await authority.execute(created.room_code, Ready(guest))
        await authority.execute(created.room_code, Start(host, now_ms=1_000))
        await authority.execute(created.room_code, AdvanceTurn(now_ms=2_000))
        completed = await authority.execute(
            created.room_code,
            Bell(host, now_ms=2_000 + int(case["reactionMs"])),
        )

        score = completed.snapshot.scoreboard[0]
        self.assertEqual(score.score, expected["score"])
        self.assertEqual(score.correct_hits, expected["correctHits"])
        actual_breakdown = score.score_breakdown.model_dump(by_alias=True)
        self.assertEqual(
            {key: actual_breakdown[key] for key in expected["breakdown"]},
            expected["breakdown"],
        )

    async def test_authority_consumes_wrong_and_missed_floor_vectors(self) -> None:
        wrong = fixture_case("two-seat-wrong-floor")
        missed = fixture_case("two-seat-missed-floor")
        authority = self.authority
        created, credentials = await self.create_room(
            "wrong-and-missed",
            (("Host", "host-credential"), ("Guest", "guest-credential")),
        )
        host, guest = credentials
        await authority.execute(created.room_code, Ready(host))
        await authority.execute(created.room_code, Ready(guest))
        await authority.execute(created.room_code, Start(host, now_ms=1_000))

        wrong_result = await authority.execute(created.room_code, Bell(host, now_ms=1_001))
        wrong_score = wrong_result.snapshot.scoreboard[0]
        wrong_expected = wrong["expected"]
        self.assertEqual(wrong_result.snapshot.last_event, "wrong_bell")
        self.assertEqual(wrong_score.score, wrong_expected["score"])
        self.assertEqual(wrong_score.wrong_hits, wrong_expected["wrongHits"])
        self.assertEqual(wrong_score.score_breakdown.wrong_penalty, wrong_expected["wrongPenalty"])
        self.assertEqual(wrong_score.score_breakdown.card_penalty, wrong_expected["cardPenalty"])

        bell_window = await authority.execute(created.room_code, AdvanceTurn(now_ms=wrong_result.snapshot.turn_deadline_at))
        missed_result = await authority.execute(
            created.room_code,
            AdvanceTurn(now_ms=bell_window.snapshot.turn_deadline_at),
        )
        missed_score = missed_result.snapshot.scoreboard[0]
        missed_expected = missed["expected"]
        self.assertEqual(missed_result.snapshot.last_event, "missed_bell")
        self.assertEqual(missed_score.score, missed_expected["score"])
        self.assertEqual(missed_score.missed_hits, missed_expected["missedHits"])
        self.assertEqual(missed_score.score_breakdown.missed_penalty, missed_expected["missedPenalty"])
