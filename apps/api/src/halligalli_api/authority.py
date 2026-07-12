from __future__ import annotations

import hashlib
import json
import secrets
import time
from dataclasses import asdict, dataclass, field
from typing import Literal, Protocol, TypeAlias

from pydantic import BaseModel, ConfigDict, Field


ROOM_TTL_SECONDS = 60 * 60
POST_MATCH_DURATION_MS = 30_000
ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
TURN_DURATION_MS = 700
SCORE_BONUS_WINDOW_MS = 1_500
MIN_PARTICIPANTS = 2
MAX_PARTICIPANTS = 6
FRUIT_ORDER = ("banana", "strawberry", "lemon", "grape")
CARD_DISTRIBUTION = ((1, 3), (2, 5), (3, 5), (4, 3), (5, 2))

CardValue: TypeAlias = tuple[Literal["banana", "strawberry", "lemon", "grape"], int]
OPENING_CARD_SEQUENCE: tuple[CardValue, ...] = (
    ("banana", 2),
    ("banana", 3),
    ("strawberry", 1),
    ("lemon", 1),
    ("grape", 1),
    ("strawberry", 1),
)


def _card_sequence() -> tuple[CardValue, ...]:
    sequence = list(OPENING_CARD_SEQUENCE)
    remaining = {
        (fruit, count): repetitions
        for fruit in FRUIT_ORDER
        for count, repetitions in CARD_DISTRIBUTION
    }
    for card in OPENING_CARD_SEQUENCE:
        remaining[card] -= 1

    for fruit in FRUIT_ORDER:
        for count, _ in CARD_DISTRIBUTION:
            sequence.extend((fruit, count) for _ in range(remaining[(fruit, count)]))

    return tuple(sequence)


CARD_SEQUENCE = _card_sequence()


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
    min_participants: int
    max_participants: int
    viewer_seat_index: int
    participants: list[ParticipantSnapshot]
    current_turn: int | None = None
    turn_deadline_at: int | None = None
    top_cards: list[CardSnapshot | None] = Field(default_factory=list)
    bell_available: bool = False
    bell_fruit: Literal["banana", "strawberry", "lemon", "grape"] | None = None
    scoreboard: list[ParticipantScore] = Field(default_factory=list)
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
    next_card_index: int = 0
    bell_fruit: Literal["banana", "strawberry", "lemon", "grape"] | None = None
    bell_opened_at: int | None = None
    scores: list[_ParticipantScore] = field(default_factory=list)
    last_event: Literal["correct_bell", "wrong_bell", "missed_bell"] | None = None
    result: _MatchResult | None = None
    number: int = 0


@dataclass
class _Room:
    code: str
    revision: int = 1
    max_participants: int = MAX_PARTICIPANTS
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
            max_participants=raw["max_participants"],
            phase=raw["phase"],
            participants=[_Participant(**participant) for participant in raw["participants"]],
            idempotency={
                key: _IdempotencyEntry(**entry)
                for key, entry in raw["idempotency"].items()
            },
            commands={key: _CommandEntry(**entry) for key, entry in raw.get("commands", {}).items()},
            match_number=raw.get("match_number", 0),
            host_seat_index=raw.get("host_seat_index", 0),
            post_match_deadline_at=raw.get("post_match_deadline_at"),
            match=(
                _Match(
                    current_turn=raw["match"]["current_turn"],
                    turn_deadline_at=raw["match"]["turn_deadline_at"],
                    top_cards=[
                        _Card(**card) if card is not None else None
                        for card in raw["match"]["top_cards"]
                    ],
                    next_card_index=raw["match"]["next_card_index"],
                    bell_fruit=raw["match"]["bell_fruit"],
                    bell_opened_at=raw["match"]["bell_opened_at"],
                    scores=[_ParticipantScore(**score) for score in raw["match"]["scores"]],
                    last_event=raw["match"]["last_event"],
                    result=(
                        _MatchResult(**raw["match"]["result"])
                        if raw["match"]["result"] is not None
                        else None
                    ),
                    number=raw["match"].get("number", 0),
                )
                if raw["match"] is not None
                else None
            ),
        )


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
        for seat_index, score in enumerate(match.scores)
    ]


def _snapshot_for_verifier(room: _Room, verifier: str) -> RoomSnapshot:
    for participant in room.participants:
        if secrets.compare_digest(participant.credential_verifier, verifier):
            match = room.match
            return RoomSnapshot(
                room_code=room.code,
                revision=room.revision,
                phase=room.phase,
                min_participants=MIN_PARTICIPANTS,
                max_participants=room.max_participants,
                viewer_seat_index=participant.seat_index,
                participants=[
                    ParticipantSnapshot(name=item.name, seat_index=item.seat_index, ready=item.ready, active=item.active)
                    for item in _active_participants(room)
                ],
                current_turn=match.current_turn if match and room.phase == "playing" else None,
                turn_deadline_at=match.turn_deadline_at if match and room.phase == "playing" else None,
                top_cards=(
                    [
                        CardSnapshot(fruit=card.fruit, count=card.count) if card is not None else None
                        for card in match.top_cards
                    ]
                    if match
                    else []
                ),
                bell_available=bool(match and match.bell_fruit),
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


def _next_active_seat(room: _Room, current_seat: int) -> int:
    seats = [participant.seat_index for participant in _active_participants(room)]
    if not seats:
        raise AuthorityError("room_empty", 409, "Room has no participants")
    return next((seat for seat in seats if seat > current_seat), seats[0])


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
    room.commands[command_id] = _CommandEntry(fingerprint=fingerprint)
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


def _finish_match(room: _Room) -> None:
    match = room.match
    if match is None:
        raise AuthorityError("match_not_running", 409, "Match is not running")
    winner_seat_index = min(
        range(len(match.scores)),
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
    room.post_match_deadline_at = int(time.time_ns() // 1_000_000) + POST_MATCH_DURATION_MS
    for participant in _active_participants(room):
        participant.continue_playing = None


def _flip_next(room: _Room, now_ms: int) -> None:
    match = room.match
    if match is None or not _active_participants(room):
        raise AuthorityError("match_not_running", 409, "Match is not running")
    if match.next_card_index >= len(CARD_SEQUENCE):
        raise AuthorityError("match_complete", 409, "Match has no more cards")

    fruit, count = CARD_SEQUENCE[match.next_card_index]
    match.top_cards[match.current_turn] = _Card(fruit=fruit, count=count)
    match.next_card_index += 1
    match.current_turn = _next_active_seat(room, match.current_turn)
    match.turn_deadline_at = now_ms + TURN_DURATION_MS
    match.bell_fruit = _bell_fruit(match.top_cards)
    match.bell_opened_at = now_ms if match.bell_fruit is not None else None


def _apply_room_command(room: _Room, command: AuthorityCommand) -> AuthorityResult:
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
        if len(active) < MIN_PARTICIPANTS or not all(item.ready for item in active):
            raise AuthorityError("players_not_ready", 409, "All participants must be ready")

        room.phase = "playing"
        room.match = _Match(
            current_turn=0,
            turn_deadline_at=None,
            top_cards=[None] * (max(item.seat_index for item in active) + 1),
            scores=[_ParticipantScore() for _ in range(max(item.seat_index for item in active) + 1)],
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
            if room.match.next_card_index >= len(CARD_SEQUENCE):
                _finish_match(room)
            else:
                _flip_next(room, command.now_ms)
        elif room.match.next_card_index >= len(CARD_SEQUENCE):
            _finish_match(room)
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
            penalty_target = (sum(card is not None for card in room.match.top_cards) + 1) // 2
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

        collected_count = sum(card is not None for card in room.match.top_cards)
        reaction_ms = max(0, command.now_ms - (room.match.bell_opened_at or command.now_ms))
        _award_correct(score, collected_count=collected_count, reaction_ms=reaction_ms)
        room.match.last_event = "correct_bell"
        room.match.top_cards = [None] * len(room.match.top_cards)
        room.match.current_turn = participant.seat_index
        room.match.bell_fruit = None
        room.match.bell_opened_at = None
        if room.match.next_card_index >= len(CARD_SEQUENCE):
            _finish_match(room)
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
        _finish_match(room)
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
    if len(room.participants) >= room.max_participants:
        raise AuthorityError("room_full", 409, "Room is full")
    if any(
        secrets.compare_digest(participant.credential_verifier, command.credential_verifier)
        for participant in room.participants
    ):
        raise AuthorityError("credential_in_use", 409, "Participant credential is already in use")

    occupied = {participant.seat_index for participant in _active_participants(room)}
    seat_index = next(index for index in range(room.max_participants) if index not in occupied)
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


class InMemoryMultiplayerAuthority:
    """Test-only implementation of the same authority interface as Redis."""

    def __init__(self, room_codes: object | None = None) -> None:
        self._rooms: dict[str, _Room] = {}
        self._create_entries: dict[str, tuple[str, str]] = {}
        self._room_codes = iter(room_codes) if room_codes is not None else None

    def _new_room_code(self) -> str:
        if self._room_codes is not None:
            return next(self._room_codes)
        return "".join(secrets.choice(ROOM_CODE_ALPHABET) for _ in range(4))

    async def execute(
        self,
        room_code: str | None,
        command: AuthorityCommand,
    ) -> AuthorityResult:
        if isinstance(command, CreateRoom):
            return self._create(command)
        room = _require_room(self._rooms.get(room_code or ""))
        if isinstance(command, JoinRoom):
            return self._join(room, command)
        return _apply_room_command(room, command)

    def _create(self, command: CreateRoom) -> EntryResult:
        fingerprint = _command_fingerprint(command)
        cached = self._create_entries.get(command.idempotency_key)
        if cached:
            cached_fingerprint, cached_room_code = cached
            if not secrets.compare_digest(cached_fingerprint, fingerprint):
                raise AuthorityError("idempotency_conflict", 409, "Idempotency key was reused")
            room = _require_room(self._rooms.get(cached_room_code))
            return EntryResult(
                room_code=room.code,
                snapshot=_snapshot_for_verifier(room, command.credential_verifier),
            )

        for _ in range(8):
            code = self._new_room_code()
            if code not in self._rooms:
                break
        else:
            raise AuthorityError("room_code_unavailable", 503, "Room code is unavailable")

        room = _Room(code=code)
        room.participants.append(
            _Participant(name=command.name, credential_verifier=command.credential_verifier, seat_index=0),
        )
        room.idempotency[command.idempotency_key] = _IdempotencyEntry(
            fingerprint=fingerprint,
            seat_index=0,
        )
        self._rooms[code] = room
        self._create_entries[command.idempotency_key] = (fingerprint, code)
        return EntryResult(
            room_code=code,
            snapshot=_snapshot_for_verifier(room, command.credential_verifier),
        )

    def _join(self, room: _Room, command: JoinRoom) -> EntryResult:
        return _join_room(room, command)

    async def snapshot(self, room_code: str, viewer: Viewer) -> RoomSnapshot:
        room = _require_room(self._rooms.get(room_code))
        return _snapshot_for_verifier(room, credential_verifier(viewer.credential))


class RedisMultiplayerAuthority:
    """Redis-backed runtime authority. In-memory authority is never selected here."""

    def __init__(self, redis_client: object) -> None:
        self._redis = redis_client

    @classmethod
    def from_url(cls, url: str) -> RedisMultiplayerAuthority:
        from redis.asyncio import Redis

        return cls(Redis.from_url(url, decode_responses=True))

    @staticmethod
    def _room_key(room_code: str) -> str:
        return f"halligalli:room:{{{room_code}}}"

    @staticmethod
    def _channel(room_code: str) -> str:
        return f"halligalli:room:{{{room_code}}}:snapshots"

    @staticmethod
    def _ttl_seconds(room: _Room) -> int:
        deadline = room.post_match_deadline_at
        if room.phase == "playing" and room.match is not None:
            deadline = room.match.turn_deadline_at
        if deadline is None:
            return ROOM_TTL_SECONDS
        return max(1, min(ROOM_TTL_SECONDS, (deadline - (time.time_ns() // 1_000_000)) // 1_000 + 60))

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
        if isinstance(command, CreateRoom):
            return await self._create(command)
        if room_code is None:
            raise AuthorityError("room_not_found", 404, "Room was not found")
        if isinstance(command, JoinRoom):
            return await self._join(room_code, command)
        return await self._execute_room_command(room_code, command)

    async def _create(self, command: CreateRoom) -> EntryResult:
        from redis.exceptions import WatchError

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

            room = _Room(code=self._new_room_code())
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
                    pipeline.hset(room_key, mapping={"state": room.to_json()})
                    pipeline.expire(room_key, self._ttl_seconds(room))
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
                    pipeline.hset(room_key, mapping={"state": room.to_json()})
                    pipeline.expire(room_key, self._ttl_seconds(room))
                    pipeline.publish(self._channel(room_code), str(room.revision))
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
                    result = _apply_room_command(room, command)
                    pipeline.multi()
                    pipeline.hset(room_key, mapping={"state": room.to_json()})
                    pipeline.expire(room_key, self._ttl_seconds(room))
                    pipeline.publish(self._channel(room_code), str(room.revision))
                    await pipeline.execute()
                    return result
            except WatchError:
                continue
        raise AuthorityError("concurrent_update", 409, "Room changed while updating")

    async def _load_room(self, room_code: str) -> _Room:
        state = await self._redis.hget(self._room_key(room_code), "state")
        return _require_room(_Room.from_json(state) if state else None)

    async def snapshot(self, room_code: str, viewer: Viewer) -> RoomSnapshot:
        room = await self._load_room(room_code)
        return _snapshot_for_verifier(room, credential_verifier(viewer.credential))

    async def aclose(self) -> None:
        close = getattr(self._redis, "aclose", None)
        if close is not None:
            await close()
