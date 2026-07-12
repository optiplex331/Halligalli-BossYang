from __future__ import annotations

import unittest

from halligalli_api.authority import ScoreBreakdown, apply_scoring_penalty, sum_breakdown


class TransitionScoreFloorTest(unittest.TestCase):
    def test_applies_base_before_card_penalty_without_hidden_debt(self) -> None:
        breakdown = apply_scoring_penalty(
            ScoreBreakdown(correct_base=54),
            wrong_penalty=50,
            card_penalty=8,
        )

        self.assertEqual(sum_breakdown(breakdown), 0)
        self.assertEqual(breakdown.wrong_penalty, 50)
        self.assertEqual(breakdown.card_penalty, 4)
