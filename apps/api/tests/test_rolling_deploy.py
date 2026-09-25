from __future__ import annotations

from halligalli_api.authority import AdvanceTurn, Bell, credential_verifier
from redis_test_case import RedisAsyncTestCase


# A two-human room mid-match as written by the release before seeded decks, durable deadlines, and forfeit names.
PREVIOUS_RELEASE_ROOM = '{"code":"LGCY","commands":{"r1":{"fingerprint":"8461d52e354b1f3de2248e5e65d6a30789a1ce426e2d2ceefda94778047ae46b"}},"difficulty":"normal","duration_sec":60,"host_seat_index":0,"idempotency":{},"match":{"bell_fruit":null,"bell_opened_at":null,"current_turn":1,"face_up_card_counts":[1,0,0,0],"frozen_human_seat_indexes":[0,1],"last_event":null,"next_card_index":1,"number":1,"result":null,"reveal_sequence":1,"scores":{"0":{"breakdown":{"card_penalty":0,"collection_bonus":0,"correct_base":0,"missed_penalty":0,"speed_bonus":0,"streak_bonus":0,"wrong_penalty":0},"correct_hits":0,"missed_hits":0,"streak":0,"wrong_hits":0},"1":{"breakdown":{"card_penalty":0,"collection_bonus":0,"correct_base":0,"missed_penalty":0,"speed_bonus":0,"streak_bonus":0,"wrong_penalty":0},"correct_hits":0,"missed_hits":0,"streak":0,"wrong_hits":0}},"top_cards":[{"count":2,"fruit":"banana"},null,null,null],"turn_deadline_at":1700},"match_number":1,"participants":[{"active":true,"continue_playing":null,"credential_verifier":"5bd960e40874e5746bab710cfeb5d7d79a7d0e7f8177ce91c1a966b64e08223a","name":"Host","ready":true,"seat_index":0},{"active":true,"continue_playing":null,"credential_verifier":"aee1118bc7c67cdcc5ba1c80f5e0059af4043fd807e69ed565bd9d8804244fef","name":"Guest","ready":true,"seat_index":1}],"phase":"playing","post_match_deadline_at":null,"revision":4,"table_seat_count":4,"target_human_participant_count":2}'


class RollingDeployTest(RedisAsyncTestCase):
    async def test_a_room_written_by_the_previous_release_keeps_playing(self) -> None:
        await self.redis.hset("halligalli:room:{LGCY}", mapping={"state": PREVIOUS_RELEASE_ROOM})

        advanced = await self.authority.execute("LGCY", AdvanceTurn(now_ms=1_700))
        rung = await self.authority.execute("LGCY", Bell(credential_verifier("legacy-guest"), now_ms=1_710))
        due = await self.authority.advance_due(rung.snapshot.turn_deadline_at)

        self.assertEqual(advanced.snapshot.bell_fruit, "banana")
        self.assertEqual(rung.snapshot.last_event, "correct_bell")
        self.assertEqual(
            [(score.name, score.forfeited, score.correct_hits) for score in rung.snapshot.scoreboard],
            [("Host", False, 0), ("Guest", False, 1)],
        )
        self.assertEqual(due, ["LGCY"])
