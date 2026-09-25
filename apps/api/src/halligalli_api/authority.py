from __future__ import annotations

import hashlib
import json
import logging
import random
import secrets
import time
from dataclasses import asdict, dataclass, field
from collections.abc import AsyncIterator, Callable, Sequence
from typing import Literal, Protocol, TypeAlias

from pydantic import BaseModel, ConfigDict, Field

from .observability import elapsed_since


_logger = logging.getLogger("halligalli.authority")


ROOM_TTL_SECONDS = 60 * 60
DUE_INDEX_KEY = "halligalli:rooms:due"
ACTIVE_ROOMS_KEY = "halligalli:rooms:active"
COMMAND_HISTORY_LIMIT = 128
POST_MATCH_DURATION_MS = 30_000
ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
SCORE_BONUS_WINDOW_MS = 1_500
Difficulty: TypeAlias = Literal["easy", "normal", "hard"]
# Difficulty -> (turn interval ms, Bell Window ms).
MATCH_PACE: dict[str, tuple[int, int]] = {
    "easy": (900, 1_800),
    "normal": (700, 1_500),
    "hard": (550, 1_200),
}
MIN_TABLE_SEATS = 4
MAX_TABLE_SEATS = 8
MIN_HUMAN_PARTICIPANTS = 2
FRUIT_ORDER = ("banana", "strawberry", "lemon", "grape")
CARD_DISTRIBUTION = ((1, 3), (2, 5), (3, 5), (4, 3), (5, 2))

CardValue: TypeAlias = tuple[Literal["banana", "strawberry", "lemon", "grape"], int]
EARLY_BELL_REVEALS = 8


def wall_clock_ms() -> int:
    return time.time_ns() // 1_000_000


class DeckSource(Protocol):
    def new_seed(self) -> int: ...

    def deal(self, seed: int, table_seat_count: int) -> Sequence[CardValue]: ...


def _opens_early_bell(cards: Sequence[CardValue], table_seat_count: int) -> bool:
    """Whether a table without prior bells shows an exact five within the first reveals."""
    for revealed in range(1, min(EARLY_BELL_REVEALS, len(cards)) + 1):
        visible = cards[max(0, revealed - table_seat_count):revealed]
        totals = {fruit: 0 for fruit in FRUIT_ORDER}
        for fruit, count in visible:
            totals[fruit] += count
        if 5 in totals.values():
            return True
    return False


class StandardDeck:
    """Shuffles the standard distribution from a seed, guaranteeing an early exact-five opportunity."""

    def __init__(self, seed_source: Callable[[], int] | None = None) -> None:
        self._seed_source = seed_source or (lambda: secrets.randbits(63))

    def new_seed(self) -> int:
        return self._seed_source()

    def deal(self, seed: int, table_seat_count: int) -> tuple[CardValue, ...]:
        rng = random.Random(seed)
        cards: list[CardValue] = [
            (fruit, count)
            for fruit in FRUIT_ORDER
            for count, repetitions in CARD_DISTRIBUTION
            for _ in range(repetitions)
        ]
        while True:
            rng.shuffle(cards)
            if _opens_early_bell(cards, table_seat_count):
                return tuple(cards)


def _camel_case(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(word.capitalize() for word in tail)


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=_camel_case, populate_by_name=True)


class ParticipantSnapshot(ApiModel):
    name: str
    seat_index: int
    ready: bool = False
    active: bool = True


class CardSnapshot(ApiModel):
    fruit: Literal["banana", "strawberry", "lemon", "grape"]
    count: int


class ScoreBreakdown(ApiModel):
    correct_base: int = 0
    collection_bonus: int = 0
    speed_bonus: int = 0
    streak_bonus: int = 0
    wrong_penalty: int = 0
    missed_penalty: int = 0
    card_penalty: int = 0


def sum_breakdown(breakdown: ScoreBreakdown) -> int:
    return (
        breakdown.correct_base
        + breakdown.collection_bonus
        + breakdown.speed_bonus
        + breakdown.streak_bonus
        - breakdown.wrong_penalty
        - breakdown.missed_penalty
        - breakdown.card_penalty
    )


class ParticipantScore(ApiModel):
    seat_index: int
    score: int
    correct_hits: int
    wrong_hits: int
    missed_hits: int
    score_breakdown: ScoreBreakdown


class MatchResult(ApiModel):
    winner_seat_index: int
    score: int
    participants: list[ParticipantScore]


class RoomConfiguration(ApiModel):
    table_seat_count: int
    target_human_participant_count: int
    difficulty: Difficulty


class TableSeatSnapshot(ApiModel):
    seat_index: int
    top_card: CardSnapshot | None = None
    face_up_card_count: int = 0


class RevealSnapshot(ApiModel):
    sequence: int
    seat_index: int


def apply_scoring_penalty(
    breakdown: ScoreBreakdown,
    *,
    wrong_penalty: int = 0,
    card_penalty: int = 0,
    missed_penalty: int = 0,
) -> ScoreBreakdown:
    available = max(0, sum_breakdown(breakdown))
    applied_wrong = min(available, wrong_penalty)
    available -= applied_wrong
    applied_card = min(available, card_penalty)
    available -= applied_card
    applied_missed = min(available, missed_penalty)
    return breakdown.model_copy(
        update={
            "wrong_penalty": breakdown.wrong_penalty + applied_wrong,
            "card_penalty": breakdown.card_penalty + applied_card,
            "missed_penalty": breakdown.missed_penalty + applied_missed,
        },
    )


class RoomSnapshot(ApiModel):
    room_code: str
    revision: int
    phase: Literal["lobby", "playing", "post_match"]
    configuration: RoomConfiguration
    viewer_seat_index: int
    participants: list[ParticipantSnapshot]
    current_turn_seat_index: int | None = None
    turn_deadline_at: int | None = None
    seats: list[TableSeatSnapshot]
    last_reveal: RevealSnapshot | None = None
    allowed_commands: list[Literal["ready", "start", "bell", "leave", "forfeit", "continue", "post_match_leave"]]
    bell_fruit: Literal["banana", "strawberry", "lemon", "grape"] | None = None
    scoreboard: list[ParticipantScore]
    last_event: Literal["correct_bell", "wrong_bell", "missed_bell"] | None = None
    result: MatchResult | None = None
    match_number: int = 0
    post_match_deadline_at: int | None = None


class AuthorityResult(ApiModel):
    room_code: str
    snapshot: RoomSnapshot


class EntryResult(AuthorityResult):
    pass


class AuthorityError(Exception):
    def __init__(self, code: str, status_code: int, title: str) -> None:
        super().__init__(title)
        self.code = code
        self.status_code = status_code
        self.title = title


@dataclass(frozen=True)
class CreateRoom:
    idempotency_key: str
    name: str
    credential_verifier: str
    table_seat_count: int
    target_human_participant_count: int
    difficulty: Difficulty


@dataclass(frozen=True)
class JoinRoom:
    idempotency_key: str
    name: str
    credential_verifier: str


@dataclass(frozen=True)
class Ready:
    credential_verifier: str
    command_id: str | None = None


@dataclass(frozen=True)
class Start:
    credential_verifier: str
    now_ms: int
    command_id: str | None = None


@dataclass(frozen=True)
class Bell:
    credential_verifier: str
    now_ms: int
    command_id: str | None = None


@dataclass(frozen=True)
class AdvanceTurn:
    now_ms: int
    command_id: str | None = None


@dataclass(frozen=True)
class Leave:
    credential_verifier: str
    command_id: str | None = None


@dataclass(frozen=True)
class Forfeit:
    credential_verifier: str
    now_ms: int
    command_id: str | None = None


@dataclass(frozen=True)
class ContinueMatch:
    credential_verifier: str
    continue_playing: bool
    command_id: str | None = None


@dataclass(frozen=True)
class AdvancePostMatch:
    now_ms: int
    command_id: str | None = None


AuthorityCommand: TypeAlias = CreateRoom | JoinRoom | Ready | Start | Bell | AdvanceTurn | Leave | Forfeit | ContinueMatch | AdvancePostMatch


@dataclass(frozen=True)
class Viewer:
    credential: str


class MultiplayerAuthority(Protocol):
    async def execute(
        self,
        room_code: str | None,
        command: AuthorityCommand,
    ) -> AuthorityResult: ...

    async def snapshot(self, room_code: str, viewer: Viewer) -> RoomSnapshot: ...

    def now_ms(self) -> int: ...

    async def advance_due(self, now_ms: int | None = None) -> list[str]: ...


class RedisRevisionSubscription:
    """A ready Redis pattern subscription for room snapshot invalidations."""

    _pattern = "halligalli:room:*:snapshots"
    _prefix = "halligalli:room:{"
    _suffix = "}:snapshots"

    def __init__(self, pubsub: object) -> None:
        self._pubsub = pubsub

    async def events(self) -> AsyncIterator[str]:
        async for message in self._pubsub.listen():
            if message.get("type") != "pmessage":
                continue
            channel = message.get("channel")
            if isinstance(channel, bytes):
                channel = channel.decode()
            if not isinstance(channel, str):
                continue
            if channel.startswith(self._prefix) and channel.endswith(self._suffix):
                yield channel.removeprefix(self._prefix).removesuffix(self._suffix)

    async def aclose(self) -> None:
        await self._pubsub.punsubscribe(self._pattern)
        close = getattr(self._pubsub, "aclose", None)
        if close is not None:
            await close()


@dataclass
class _Participant:
    name: str
    credential_verifier: str
    seat_index: int
    ready: bool = False
    active: bool = True
    continue_playing: bool | None = None


@dataclass
class _IdempotencyEntry:
    fingerprint: str
    seat_index: int


@dataclass
class _CommandEntry:
    fingerprint: str
    revision: int = 0


@dataclass
class _Card:
    fruit: Literal["banana", "strawberry", "lemon", "grape"]
    count: int


@dataclass
class _MatchResult:
    winner_seat_index: int
    score: int


@dataclass
class _ParticipantScore:
    correct_hits: int = 0
    wrong_hits: int = 0
    missed_hits: int = 0
    streak: int = 0
    breakdown: dict[str, int] = field(
        default_factory=lambda: {
            "correct_base": 0,
            "collection_bonus": 0,
            "speed_bonus": 0,
            "streak_bonus": 0,
            "wrong_penalty": 0,
            "missed_penalty": 0,
            "card_penalty": 0,
        },
    )


@dataclass
class _Match:
    current_turn: int
    turn_deadline_at: int | None
    top_cards: list[_Card | None]
    face_up_card_counts: list[int]
    frozen_human_seat_indexes: list[int]
    seed: int = 0
    deck: list[tuple[str, int]] = field(default_factory=list)
    reveal_sequence: int = 0
    next_card_index: int = 0
    bell_fruit: Literal["banana", "strawberry", "lemon", "grape"] | None = None
    bell_opened_at: int | None = None
    scores: dict[int, _ParticipantScore] = field(default_factory=dict)
    last_event: Literal["correct_bell", "wrong_bell", "missed_bell"] | None = None
    result: _MatchResult | None = None
    number: int = 0


@dataclass
class _Room:
    code: str
    revision: int = 1
    table_seat_count: int = MIN_TABLE_SEATS
    target_human_participant_count: int = MIN_HUMAN_PARTICIPANTS
    difficulty: Difficulty = "normal"
    phase: Literal["lobby", "playing", "post_match"] = "lobby"
    participants: list[_Participant] = field(default_factory=list)
    idempotency: dict[str, _IdempotencyEntry] = field(default_factory=dict)
    commands: dict[str, _CommandEntry] = field(default_factory=dict)
    match: _Match | None = None
    match_number: int = 0
    host_seat_index: int = 0
    post_match_deadline_at: int | None = None

    def to_json(self) -> str:
        return json.dumps(asdict(self), separators=(",", ":"), sort_keys=True)

    @classmethod
    def from_json(cls, value: str) -> _Room:
        raw = json.loads(value)
        return cls(
            code=raw["code"],
            revision=raw["revision"],
            table_seat_count=raw["table_seat_count"],
            target_human_participant_count=raw["target_human_participant_count"],
            difficulty=raw["difficulty"],
            phase=raw["phase"],
            participants=[_Participant(**participant) for participant in raw["participants"]],
            idempotency={
                key: _IdempotencyEntry(**entry)
                for key, entry in raw["idempotency"].items()
            },
            commands={key: _CommandEntry(**entry) for key, entry in raw["commands"].items()},
            match_number=raw["match_number"],
            host_seat_index=raw["host_seat_index"],
            post_match_deadline_at=raw["post_match_deadline_at"],
            match=(
                _Match(
                    current_turn=raw["match"]["current_turn"],
                    turn_deadline_at=raw["match"]["turn_deadline_at"],
                    top_cards=[
                        _Card(**card) if card is not None else None
                        for card in raw["match"]["top_cards"]
                    ],
                    face_up_card_counts=raw["match"]["face_up_card_counts"],
                    frozen_human_seat_indexes=raw["match"]["frozen_human_seat_indexes"],
                    seed=raw["match"]["seed"],
                    deck=[(fruit, count) for fruit, count in raw["match"]["deck"]],
                    reveal_sequence=raw["match"]["reveal_sequence"],
                    next_card_index=raw["match"]["next_card_index"],
                    bell_fruit=raw["match"]["bell_fruit"],
                    bell_opened_at=raw["match"]["bell_opened_at"],
                    scores={int(seat): _ParticipantScore(**score) for seat, score in raw["match"]["scores"].items()},
                    last_event=raw["match"]["last_event"],
                    result=(
                        _MatchResult(**raw["match"]["result"])
                        if raw["match"]["result"] is not None
                        else None
                    ),
                    number=raw["match"]["number"],
                )
                if raw["match"] is not None
                else None
            ),
        )


def _due_at(room: _Room) -> int | None:
    if room.phase == "playing" and room.match is not None:
        return room.match.turn_deadline_at
    if room.phase == "post_match":
        return room.post_match_deadline_at
    return None


def _due_command(room: _Room, now_ms: int) -> AdvanceTurn | AdvancePostMatch | None:
    due_at = _due_at(room)
    if due_at is None or now_ms < due_at:
        return None
    if room.phase == "playing":
        return AdvanceTurn(now_ms=now_ms)
    return AdvancePostMatch(now_ms=now_ms)


def credential_verifier(credential: str) -> str:
    return hashlib.sha256(credential.encode("utf-8")).hexdigest()


def _command_fingerprint(command: AuthorityCommand) -> str:
    source = json.dumps(
        {
            "kind": type(command).__name__,
            "payload": asdict(command),
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(source.encode("utf-8")).hexdigest()


def _breakdown_for(score: _ParticipantScore) -> ScoreBreakdown:
    return ScoreBreakdown(**score.breakdown)


def _score_for(score: _ParticipantScore) -> int:
    return max(0, sum_breakdown(_breakdown_for(score)))


def _scoreboard_for(match: _Match | None) -> list[ParticipantScore]:
    if match is None:
        return []
    return [
        ParticipantScore(
            seat_index=seat_index,
            score=_score_for(score),
            correct_hits=score.correct_hits,
            wrong_hits=score.wrong_hits,
            missed_hits=score.missed_hits,
            score_breakdown=_breakdown_for(score),
        )
        for seat_index, score in sorted(match.scores.items())
    ]


def _allowed_commands(room: _Room, participant: _Participant) -> list[str]:
    if not participant.active:
        return []
    if room.phase == "lobby":
        commands = ["leave"]
        if not participant.ready:
            commands.append("ready")
        active = _active_participants(room)
        if (
            participant.seat_index == room.host_seat_index
            and len(active) == room.target_human_participant_count
            and all(item.ready for item in active)
        ):
            commands.append("start")
        return commands
    if room.phase == "playing":
        return ["bell", "forfeit"] if participant.active else []
    return ["continue", "post_match_leave"] if participant.active else []


def _snapshot_for_verifier(room: _Room, verifier: str) -> RoomSnapshot:
    for participant in room.participants:
        if secrets.compare_digest(participant.credential_verifier, verifier):
            match = room.match
            return RoomSnapshot(
                room_code=room.code,
                revision=room.revision,
                phase=room.phase,
                configuration=RoomConfiguration(
                    table_seat_count=room.table_seat_count,
                    target_human_participant_count=room.target_human_participant_count,
                    difficulty=room.difficulty,
                ),
                viewer_seat_index=participant.seat_index,
                participants=[
                    ParticipantSnapshot(name=item.name, seat_index=item.seat_index, ready=item.ready, active=item.active)
                    for item in _active_participants(room)
                ],
                current_turn_seat_index=match.current_turn if match and room.phase == "playing" else None,
                turn_deadline_at=match.turn_deadline_at if match and room.phase == "playing" else None,
                seats=[
                    TableSeatSnapshot(
                        seat_index=seat_index,
                        top_card=(CardSnapshot(fruit=card.fruit, count=card.count) if card is not None else None),
                        face_up_card_count=(match.face_up_card_counts[seat_index] if match else 0),
                    )
                    for seat_index, card in enumerate(match.top_cards if match else [None] * room.table_seat_count)
                ],
                last_reveal=(
                    RevealSnapshot(sequence=match.reveal_sequence, seat_index=(match.current_turn - 1) % room.table_seat_count)
                    if match and match.reveal_sequence
                    else None
                ),
                allowed_commands=_allowed_commands(room, participant),
                bell_fruit=match.bell_fruit if match else None,
                scoreboard=_scoreboard_for(match),
                last_event=match.last_event if match else None,
                result=(
                    MatchResult(
                        winner_seat_index=match.result.winner_seat_index,
                        score=match.result.score,
                        participants=_scoreboard_for(match),
                    )
                    if match and match.result
                    else None
                ),
                match_number=room.match_number,
                post_match_deadline_at=room.post_match_deadline_at,
            )
    raise AuthorityError("credential_invalid", 401, "Participant credential is invalid")


def _require_room(room: _Room | None) -> _Room:
    if room is None:
        raise AuthorityError("room_not_found", 404, "Room was not found")
    return room


def _participant_for_verifier(room: _Room, verifier: str) -> _Participant:
    for participant in room.participants:
        if secrets.compare_digest(participant.credential_verifier, verifier):
            if not participant.active:
                raise AuthorityError("participant_departed", 409, "Participant has left the room")
            return participant
    raise AuthorityError("credential_invalid", 401, "Participant credential is invalid")


def _result_for_verifier(room: _Room, verifier: str) -> AuthorityResult:
    return AuthorityResult(room_code=room.code, snapshot=_snapshot_for_verifier(room, verifier))


def _active_participants(room: _Room) -> list[_Participant]:
    return [participant for participant in room.participants if participant.active]


def _cache_or_conflict(room: _Room, command: AuthorityCommand) -> AuthorityResult | None:
    command_id = getattr(command, "command_id", None)
    if command_id is None:
        return None
    fingerprint = _command_fingerprint(command)
    cached = room.commands.get(command_id)
    if cached is not None:
        if not secrets.compare_digest(cached.fingerprint, fingerprint):
            raise AuthorityError("command_id_conflict", 409, "Command ID was reused")
        verifier = getattr(command, "credential_verifier", None)
        if verifier is None:
            verifier = _active_participants(room)[0].credential_verifier
        return _result_for_verifier(room, verifier)
    room.commands[command_id] = _CommandEntry(fingerprint=fingerprint, revision=room.revision)
    if len(room.commands) > COMMAND_HISTORY_LIMIT:
        oldest = min(room.commands, key=lambda key: room.commands[key].revision)
        del room.commands[oldest]
    return None


def _bell_fruit(top_cards: list[_Card | None]) -> Literal["banana", "strawberry", "lemon", "grape"] | None:
    totals = {fruit: 0 for fruit in FRUIT_ORDER}
    for card in top_cards:
        if card is not None:
            totals[card.fruit] += card.count
    return next((fruit for fruit in FRUIT_ORDER if totals[fruit] == 5), None)


def _apply_penalty_to(
    score: _ParticipantScore,
    *,
    wrong_penalty: int = 0,
    card_penalty: int = 0,
    missed_penalty: int = 0,
) -> None:
    score.breakdown = apply_scoring_penalty(
        _breakdown_for(score),
        wrong_penalty=wrong_penalty,
        card_penalty=card_penalty,
        missed_penalty=missed_penalty,
    ).model_dump()


def _award_correct(score: _ParticipantScore, *, collected_count: int, reaction_ms: int) -> None:
    speed_bonus = max(0, (SCORE_BONUS_WINDOW_MS - reaction_ms + 10) // 20)
    streak_bonus = score.streak * 10
    score.breakdown["correct_base"] += 120
    score.breakdown["collection_bonus"] += collected_count * 6
    score.breakdown["speed_bonus"] += speed_bonus
    score.breakdown["streak_bonus"] += streak_bonus
    score.correct_hits += 1
    score.streak += 1


def _deck_exhausted(match: _Match) -> bool:
    return match.next_card_index >= len(match.deck)


def _finish_match(room: _Room, now_ms: int) -> None:
    match = room.match
    if match is None:
        raise AuthorityError("match_not_running", 409, "Match is not running")
    winner_seat_index = min(
        match.frozen_human_seat_indexes,
        key=lambda seat_index: (-_score_for(match.scores[seat_index]), seat_index),
    )
    match.result = _MatchResult(
        winner_seat_index=winner_seat_index,
        score=_score_for(match.scores[winner_seat_index]),
    )
    match.turn_deadline_at = None
    match.bell_fruit = None
    match.bell_opened_at = None
    room.phase = "post_match"
    room.post_match_deadline_at = now_ms + POST_MATCH_DURATION_MS
    for participant in _active_participants(room):
        participant.continue_playing = None


def _flip_next(room: _Room, now_ms: int) -> None:
    match = room.match
    if match is None or not _active_participants(room):
        raise AuthorityError("match_not_running", 409, "Match is not running")
    if _deck_exhausted(match):
        raise AuthorityError("match_complete", 409, "Match has no more cards")

    fruit, count = match.deck[match.next_card_index]
    match.top_cards[match.current_turn] = _Card(fruit=fruit, count=count)
    match.face_up_card_counts[match.current_turn] += 1
    match.next_card_index += 1
    match.reveal_sequence += 1
    match.current_turn = (match.current_turn + 1) % room.table_seat_count
    match.bell_fruit = _bell_fruit(match.top_cards)
    turn_interval_ms, bell_window_ms = MATCH_PACE[room.difficulty]
    match.turn_deadline_at = now_ms + (bell_window_ms if match.bell_fruit is not None else turn_interval_ms)
    match.bell_opened_at = now_ms if match.bell_fruit is not None else None


def _apply_room_command(room: _Room, command: AuthorityCommand, deck: DeckSource) -> AuthorityResult:
    cached = _cache_or_conflict(room, command)
    if cached is not None:
        return cached
    if isinstance(command, Ready):
        if room.phase != "lobby":
            raise AuthorityError("room_not_joinable", 409, "Room is not in the lobby")
        participant = _participant_for_verifier(room, command.credential_verifier)
        if participant.ready:
            raise AuthorityError("already_ready", 409, "Participant is already ready")
        participant.ready = True
        room.revision += 1
        return _result_for_verifier(room, command.credential_verifier)

    if isinstance(command, Start):
        participant = _participant_for_verifier(room, command.credential_verifier)
        if room.phase != "lobby":
            raise AuthorityError("match_already_started", 409, "Match already started")
        if participant.seat_index != room.host_seat_index:
            raise AuthorityError("host_required", 403, "Only the host can start the match")
        active = _active_participants(room)
        if len(active) != room.target_human_participant_count or not all(item.ready for item in active):
            raise AuthorityError("players_not_ready", 409, "All participants must be ready")

        room.phase = "playing"
        seed = deck.new_seed()
        room.match = _Match(
            seed=seed,
            deck=list(deck.deal(seed, room.table_seat_count)),
            current_turn=0,
            turn_deadline_at=None,
            top_cards=[None] * room.table_seat_count,
            face_up_card_counts=[0] * room.table_seat_count,
            frozen_human_seat_indexes=[item.seat_index for item in active],
            scores={item.seat_index: _ParticipantScore() for item in active},
            number=room.match_number + 1,
        )
        room.match_number += 1
        _flip_next(room, command.now_ms)
        room.revision += 1
        return _result_for_verifier(room, command.credential_verifier)

    if isinstance(command, AdvanceTurn):
        if room.phase != "playing" or room.match is None:
            raise AuthorityError("match_not_running", 409, "Match is not running")
        if room.match.turn_deadline_at is None or command.now_ms < room.match.turn_deadline_at:
            raise AuthorityError("deadline_not_due", 409, "Turn deadline is not due")
        if room.match.bell_fruit is not None:
            for participant in _active_participants(room):
                score = room.match.scores[participant.seat_index]
                _apply_penalty_to(score, missed_penalty=30)
                score.missed_hits += 1
                score.streak = 0
            room.match.last_event = "missed_bell"
            if _deck_exhausted(room.match):
                _finish_match(room, command.now_ms)
            else:
                _flip_next(room, command.now_ms)
        elif _deck_exhausted(room.match):
            _finish_match(room, command.now_ms)
        else:
            _flip_next(room, command.now_ms)
        room.revision += 1
        return _result_for_verifier(room, _active_participants(room)[0].credential_verifier)

    if isinstance(command, Bell):
        participant = _participant_for_verifier(room, command.credential_verifier)
        if room.phase != "playing" or room.match is None:
            raise AuthorityError("match_not_running", 409, "Match is not running")
        score = room.match.scores[participant.seat_index]
        if room.match.bell_fruit is None:
            penalty_target = (sum(room.match.face_up_card_counts) + 1) // 2
            _apply_penalty_to(
                score,
                wrong_penalty=50,
                card_penalty=penalty_target * 4,
            )
            score.wrong_hits += 1
            score.streak = 0
            room.match.last_event = "wrong_bell"
            room.revision += 1
            return _result_for_verifier(room, command.credential_verifier)

        collected_count = sum(room.match.face_up_card_counts)
        reaction_ms = max(0, command.now_ms - (room.match.bell_opened_at or command.now_ms))
        _award_correct(score, collected_count=collected_count, reaction_ms=reaction_ms)
        room.match.last_event = "correct_bell"
        room.match.top_cards = [None] * len(room.match.top_cards)
        room.match.face_up_card_counts = [0] * len(room.match.face_up_card_counts)
        room.match.current_turn = participant.seat_index
        room.match.bell_fruit = None
        room.match.bell_opened_at = None
        if _deck_exhausted(room.match):
            _finish_match(room, command.now_ms)
        room.revision += 1
        return _result_for_verifier(room, command.credential_verifier)

    if isinstance(command, Leave):
        if room.phase != "lobby":
            raise AuthorityError("leave_not_allowed", 409, "Lobby leave is not available during a match")
        participant = _participant_for_verifier(room, command.credential_verifier)
        participant.active = False
        participant.ready = False
        if participant.seat_index == room.host_seat_index and _active_participants(room):
            room.host_seat_index = _active_participants(room)[0].seat_index
        room.revision += 1
        return _result_for_verifier(room, command.credential_verifier)

    if isinstance(command, Forfeit):
        participant = _participant_for_verifier(room, command.credential_verifier)
        if room.phase != "playing" or room.match is None:
            raise AuthorityError("forfeit_not_allowed", 409, "Forfeit is only available during a match")
        participant.active = False
        participant.continue_playing = False
        room.match.last_event = "wrong_bell"
        _finish_match(room, command.now_ms)
        room.revision += 1
        return _result_for_verifier(room, command.credential_verifier)

    if isinstance(command, ContinueMatch):
        participant = _participant_for_verifier(room, command.credential_verifier)
        if room.phase != "post_match":
            raise AuthorityError("post_match_not_active", 409, "Match is not awaiting decisions")
        participant.continue_playing = command.continue_playing
        room.revision += 1
        return _result_for_verifier(room, command.credential_verifier)

    if isinstance(command, AdvancePostMatch):
        if room.phase != "post_match" or room.post_match_deadline_at is None:
            raise AuthorityError("post_match_not_active", 409, "Match is not awaiting decisions")
        if command.now_ms < room.post_match_deadline_at:
            raise AuthorityError("deadline_not_due", 409, "Post-match deadline is not due")
        for participant in _active_participants(room):
            if participant.continue_playing is True:
                participant.ready = False
                participant.continue_playing = None
            else:
                participant.active = False
        active = _active_participants(room)
        room.match = None
        room.post_match_deadline_at = None
        room.phase = "lobby"
        if active:
            room.host_seat_index = active[0].seat_index
        room.revision += 1
        return _result_for_verifier(room, active[0].credential_verifier if active else room.participants[0].credential_verifier)

    raise AuthorityError("command_unsupported", 400, "Command is not supported")


def _join_room(room: _Room, command: JoinRoom) -> EntryResult:
    fingerprint = _command_fingerprint(command)
    cached = room.idempotency.get(command.idempotency_key)
    if cached:
        if not secrets.compare_digest(cached.fingerprint, fingerprint):
            raise AuthorityError("idempotency_conflict", 409, "Idempotency key was reused")
        return EntryResult(
            room_code=room.code,
            snapshot=_snapshot_for_verifier(room, command.credential_verifier),
        )

    if room.phase != "lobby":
        raise AuthorityError("room_not_joinable", 409, "Room is not in the lobby")
    if len(_active_participants(room)) >= room.target_human_participant_count:
        raise AuthorityError("room_full", 409, "Room is full")
    if any(
        secrets.compare_digest(participant.credential_verifier, command.credential_verifier)
        for participant in room.participants
    ):
        raise AuthorityError("credential_in_use", 409, "Participant credential is already in use")

    occupied = {participant.seat_index for participant in _active_participants(room)}
    seat_index = next(index for index in range(room.table_seat_count) if index not in occupied)
    room.participants.append(
        _Participant(
            name=command.name,
            credential_verifier=command.credential_verifier,
            seat_index=seat_index,
        ),
    )
    room.idempotency[command.idempotency_key] = _IdempotencyEntry(
        fingerprint=fingerprint,
        seat_index=seat_index,
    )
    room.revision += 1
    return EntryResult(
        room_code=room.code,
        snapshot=_snapshot_for_verifier(room, command.credential_verifier),
    )


class RedisMultiplayerAuthority:
    """Redis-backed runtime authority."""

    def __init__(
        self,
        redis_client: object,
        telemetry: object | None = None,
        *,
        clock: Callable[[], int] = wall_clock_ms,
        deck: DeckSource | None = None,
    ) -> None:
        self._redis = redis_client
        self._telemetry = telemetry
        self._clock = clock
        self._deck = deck or StandardDeck()

    @classmethod
    def from_url(
        cls,
        url: str,
        telemetry: object | None = None,
        *,
        clock: Callable[[], int] = wall_clock_ms,
        deck: DeckSource | None = None,
    ) -> RedisMultiplayerAuthority:
        from redis.asyncio import Redis

        return cls(Redis.from_url(url, decode_responses=True), telemetry=telemetry, clock=clock, deck=deck)

    def now_ms(self) -> int:
        return self._clock()

    def _record_redis(self, operation: str, outcome: str, started_at: float) -> None:
        record = getattr(self._telemetry, "record_redis", None)
        if record is not None:
            record(operation=operation, outcome=outcome, elapsed_seconds=elapsed_since(started_at))

    @staticmethod
    def _room_key(room_code: str) -> str:
        return f"halligalli:room:{{{room_code}}}"

    @staticmethod
    def _channel(room_code: str) -> str:
        return f"halligalli:room:{{{room_code}}}:snapshots"

    async def subscribe_revisions(self) -> RedisRevisionSubscription:
        pubsub = self._redis.pubsub()
        await pubsub.psubscribe(RedisRevisionSubscription._pattern)
        return RedisRevisionSubscription(pubsub)

    def _ttl_seconds(self, room: _Room) -> int:
        deadline = _due_at(room)
        if deadline is None:
            return ROOM_TTL_SECONDS
        return max(1, min(ROOM_TTL_SECONDS, (deadline - self._clock()) // 1_000 + 60))

    def _queue_room_write(self, pipeline: object, room: _Room, *, publish: bool = True) -> None:
        """Queue the room state and its due-index entry inside the caller's transaction."""
        room_key = self._room_key(room.code)
        ttl_seconds = self._ttl_seconds(room)
        pipeline.hset(room_key, mapping={"state": room.to_json()})
        pipeline.expire(room_key, ttl_seconds)
        pipeline.zadd(ACTIVE_ROOMS_KEY, {room.code: self._clock() + ttl_seconds * 1_000})
        due_at = _due_at(room)
        if due_at is None:
            pipeline.zrem(DUE_INDEX_KEY, room.code)
        else:
            pipeline.zadd(DUE_INDEX_KEY, {room.code: due_at})
        if publish:
            pipeline.publish(self._channel(room.code), str(room.revision))

    @staticmethod
    def _entry_key(idempotency_key: str) -> str:
        return f"halligalli:entry:{idempotency_key}"

    @staticmethod
    def _new_room_code() -> str:
        return "".join(secrets.choice(ROOM_CODE_ALPHABET) for _ in range(4))

    async def execute(
        self,
        room_code: str | None,
        command: AuthorityCommand,
    ) -> AuthorityResult:
        started_at = time.perf_counter()
        try:
            if isinstance(command, CreateRoom):
                result = await self._create(command)
            elif room_code is None:
                raise AuthorityError("room_not_found", 404, "Room was not found")
            elif isinstance(command, JoinRoom):
                result = await self._join(room_code, command)
            else:
                result = await self._execute_room_command(room_code, command)
        except AuthorityError:
            self._record_redis("execute", "client_error", started_at)
            raise
        except Exception:
            self._record_redis("execute", "server_error", started_at)
            raise
        self._record_redis("execute", "success", started_at)
        return result

    async def _create(self, command: CreateRoom) -> EntryResult:
        from redis.exceptions import WatchError

        if not MIN_TABLE_SEATS <= command.table_seat_count <= MAX_TABLE_SEATS:
            raise AuthorityError("invalid_room_configuration", 422, "Table Seat count must be between 4 and 8")
        if not MIN_HUMAN_PARTICIPANTS <= command.target_human_participant_count <= command.table_seat_count:
            raise AuthorityError("invalid_room_configuration", 422, "Human Participant target must fit the table")

        fingerprint = _command_fingerprint(command)
        entry_key = self._entry_key(command.idempotency_key)
        for _ in range(8):
            existing = await self._redis.get(entry_key)
            if existing:
                cached = json.loads(existing)
                if not secrets.compare_digest(cached["fingerprint"], fingerprint):
                    raise AuthorityError("idempotency_conflict", 409, "Idempotency key was reused")
                room = await self._load_room(cached["room_code"])
                return EntryResult(
                    room_code=room.code,
                    snapshot=_snapshot_for_verifier(room, command.credential_verifier),
                )

            room = _Room(
                code=self._new_room_code(),
                table_seat_count=command.table_seat_count,
                target_human_participant_count=command.target_human_participant_count,
                difficulty=command.difficulty,
            )
            room.participants.append(
                _Participant(name=command.name, credential_verifier=command.credential_verifier, seat_index=0),
            )
            room.idempotency[command.idempotency_key] = _IdempotencyEntry(
                fingerprint=fingerprint,
                seat_index=0,
            )
            room_key = self._room_key(room.code)
            try:
                async with self._redis.pipeline(transaction=True) as pipeline:
                    await pipeline.watch(entry_key, room_key)
                    if await pipeline.get(entry_key) or await pipeline.hget(room_key, "state"):
                        continue
                    pipeline.multi()
                    self._queue_room_write(pipeline, room, publish=False)
                    pipeline.set(
                        entry_key,
                        json.dumps({"fingerprint": fingerprint, "room_code": room.code}),
                        ex=ROOM_TTL_SECONDS,
                    )
                    await pipeline.execute()
                return EntryResult(
                    room_code=room.code,
                    snapshot=_snapshot_for_verifier(room, command.credential_verifier),
                )
            except WatchError:
                continue
        raise AuthorityError("room_code_unavailable", 503, "Room code is unavailable")

    async def _join(self, room_code: str, command: JoinRoom) -> EntryResult:
        from redis.exceptions import WatchError

        room_key = self._room_key(room_code)
        for _ in range(8):
            try:
                async with self._redis.pipeline(transaction=True) as pipeline:
                    await pipeline.watch(room_key)
                    state = await pipeline.hget(room_key, "state")
                    room = _require_room(_Room.from_json(state) if state else None)
                    replayed = command.idempotency_key in room.idempotency
                    result = _join_room(room, command)
                    if replayed:
                        return result
                    pipeline.multi()
                    self._queue_room_write(pipeline, room)
                    await pipeline.execute()
                    return result
            except WatchError:
                continue
        raise AuthorityError("concurrent_update", 409, "Room changed while joining")

    async def _execute_room_command(
        self,
        room_code: str,
        command: Ready | Start | Bell | AdvanceTurn | Leave | Forfeit | ContinueMatch | AdvancePostMatch,
    ) -> AuthorityResult:
        from redis.exceptions import WatchError

        room_key = self._room_key(room_code)
        for _ in range(8):
            try:
                async with self._redis.pipeline(transaction=True) as pipeline:
                    await pipeline.watch(room_key)
                    state = await pipeline.hget(room_key, "state")
                    room = _require_room(_Room.from_json(state) if state else None)
                    result = _apply_room_command(room, command, self._deck)
                    pipeline.multi()
                    self._queue_room_write(pipeline, room)
                    await pipeline.execute()
                    return result
            except WatchError:
                continue
        raise AuthorityError("concurrent_update", 409, "Room changed while updating")

    async def advance_due(self, now_ms: int | None = None) -> list[str]:
        """Advance every room whose deadline has passed and return the codes that changed."""
        now = self._clock() if now_ms is None else now_ms
        due_codes = await self._redis.zrangebyscore(DUE_INDEX_KEY, "-inf", now)
        changed = []
        for room_code in due_codes:
            try:
                advanced = await self._advance_room_if_due(room_code, now)
            except (AuthorityError, KeyError, TypeError, ValueError):
                # A room that cannot advance must not stall every other room's deadline.
                _logger.exception("Dropping room %s from the due index", room_code)
                await self._redis.zrem(DUE_INDEX_KEY, room_code)
                continue
            if advanced:
                changed.append(room_code)
        return changed

    async def _advance_room_if_due(self, room_code: str, now_ms: int) -> bool:
        from redis.exceptions import WatchError

        room_key = self._room_key(room_code)
        for _ in range(8):
            try:
                async with self._redis.pipeline(transaction=True) as pipeline:
                    await pipeline.watch(room_key)
                    state = await pipeline.hget(room_key, "state")
                    if not state:
                        await self._redis.zrem(DUE_INDEX_KEY, room_code)
                        return False
                    room = _Room.from_json(state)
                    command = _due_command(room, now_ms)
                    if command is None:
                        return False
                    _apply_room_command(room, command, self._deck)
                    pipeline.multi()
                    self._queue_room_write(pipeline, room)
                    await pipeline.execute()
                    return True
            except WatchError:
                continue
        return False

    async def _load_room(self, room_code: str) -> _Room:
        state = await self._redis.hget(self._room_key(room_code), "state")
        return _require_room(_Room.from_json(state) if state else None)

    async def snapshot(self, room_code: str, viewer: Viewer) -> RoomSnapshot:
        started_at = time.perf_counter()
        try:
            room = await self._load_room(room_code)
            result = _snapshot_for_verifier(room, credential_verifier(viewer.credential))
        except AuthorityError:
            self._record_redis("snapshot", "client_error", started_at)
            raise
        except Exception:
            self._record_redis("snapshot", "server_error", started_at)
            raise
        self._record_redis("snapshot", "success", started_at)
        return result

    async def active_room_count(self) -> int:
        await self._redis.zremrangebyscore(ACTIVE_ROOMS_KEY, "-inf", self._clock())
        return await self._redis.zcard(ACTIVE_ROOMS_KEY)

    async def readiness(self) -> bool:
        try:
            return bool(await self._redis.ping())
        except Exception:
            return False

    async def aclose(self) -> None:
        close = getattr(self._redis, "aclose", None)
        if close is not None:
            await close()
