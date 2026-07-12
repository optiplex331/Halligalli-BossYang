from __future__ import annotations

import hashlib
import json
import secrets
from dataclasses import asdict, dataclass, field
from typing import Literal, Protocol, TypeAlias

from pydantic import BaseModel, ConfigDict, Field


ROOM_TTL_SECONDS = 60 * 60
ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
TURN_DURATION_MS = 700
CARD_SEQUENCE = (("banana", 2), ("banana", 3))
FRUIT_ORDER = ("banana", "strawberry", "lemon", "grape")


def _camel_case(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(word.capitalize() for word in tail)


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=_camel_case, populate_by_name=True)


class ParticipantSnapshot(ApiModel):
    name: str
    seat_index: int
    ready: bool = False


class CardSnapshot(ApiModel):
    fruit: Literal["banana", "strawberry", "lemon", "grape"]
    count: int


class MatchResult(ApiModel):
    winner_seat_index: int
    score: int


class RoomSnapshot(ApiModel):
    room_code: str
    revision: int
    phase: Literal["lobby", "playing", "post_match"]
    max_participants: int
    viewer_seat_index: int
    participants: list[ParticipantSnapshot]
    current_turn: int | None = None
    turn_deadline_at: int | None = None
    top_cards: list[CardSnapshot | None] = Field(default_factory=list)
    bell_available: bool = False
    bell_fruit: Literal["banana", "strawberry", "lemon", "grape"] | None = None
    result: MatchResult | None = None


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


@dataclass(frozen=True)
class Start:
    credential_verifier: str
    now_ms: int


@dataclass(frozen=True)
class Bell:
    credential_verifier: str
    now_ms: int


@dataclass(frozen=True)
class AdvanceTurn:
    now_ms: int


AuthorityCommand: TypeAlias = CreateRoom | JoinRoom | Ready | Start | Bell | AdvanceTurn


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


@dataclass
class _IdempotencyEntry:
    fingerprint: str
    seat_index: int


@dataclass
class _Card:
    fruit: Literal["banana", "strawberry", "lemon", "grape"]
    count: int


@dataclass
class _MatchResult:
    winner_seat_index: int
    score: int


@dataclass
class _Match:
    current_turn: int
    turn_deadline_at: int | None
    top_cards: list[_Card | None]
    next_card_index: int = 0
    bell_fruit: Literal["banana", "strawberry", "lemon", "grape"] | None = None
    result: _MatchResult | None = None


@dataclass
class _Room:
    code: str
    revision: int = 1
    max_participants: int = 2
    phase: Literal["lobby", "playing", "post_match"] = "lobby"
    participants: list[_Participant] = field(default_factory=list)
    idempotency: dict[str, _IdempotencyEntry] = field(default_factory=dict)
    match: _Match | None = None

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
                    result=(
                        _MatchResult(**raw["match"]["result"])
                        if raw["match"]["result"] is not None
                        else None
                    ),
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
            "name": command.name,
            "credentialVerifier": command.credential_verifier,
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(source.encode("utf-8")).hexdigest()


def _snapshot_for_verifier(room: _Room, verifier: str) -> RoomSnapshot:
    for participant in room.participants:
        if secrets.compare_digest(participant.credential_verifier, verifier):
            match = room.match
            return RoomSnapshot(
                room_code=room.code,
                revision=room.revision,
                phase=room.phase,
                max_participants=room.max_participants,
                viewer_seat_index=participant.seat_index,
                participants=[
                    ParticipantSnapshot(name=item.name, seat_index=item.seat_index, ready=item.ready)
                    for item in room.participants
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
                result=(
                    MatchResult(
                        winner_seat_index=match.result.winner_seat_index,
                        score=match.result.score,
                    )
                    if match and match.result
                    else None
                ),
            )
    raise AuthorityError("credential_invalid", 401, "Participant credential is invalid")


def _require_room(room: _Room | None) -> _Room:
    if room is None:
        raise AuthorityError("room_not_found", 404, "Room was not found")
    return room


def _participant_for_verifier(room: _Room, verifier: str) -> _Participant:
    for participant in room.participants:
        if secrets.compare_digest(participant.credential_verifier, verifier):
            return participant
    raise AuthorityError("credential_invalid", 401, "Participant credential is invalid")


def _result_for_verifier(room: _Room, verifier: str) -> AuthorityResult:
    return AuthorityResult(room_code=room.code, snapshot=_snapshot_for_verifier(room, verifier))


def _bell_fruit(top_cards: list[_Card | None]) -> Literal["banana", "strawberry", "lemon", "grape"] | None:
    totals = {fruit: 0 for fruit in FRUIT_ORDER}
    for card in top_cards:
        if card is not None:
            totals[card.fruit] += card.count
    return next((fruit for fruit in FRUIT_ORDER if totals[fruit] == 5), None)


def _flip_next(room: _Room, now_ms: int) -> None:
    match = room.match
    if match is None or not room.participants:
        raise AuthorityError("match_not_running", 409, "Match is not running")
    if match.next_card_index >= len(CARD_SEQUENCE):
        raise AuthorityError("match_complete", 409, "Match has no more cards")

    fruit, count = CARD_SEQUENCE[match.next_card_index]
    match.top_cards[match.current_turn] = _Card(fruit=fruit, count=count)
    match.next_card_index += 1
    match.current_turn = (match.current_turn + 1) % len(room.participants)
    match.turn_deadline_at = now_ms + TURN_DURATION_MS
    match.bell_fruit = _bell_fruit(match.top_cards)


def _apply_room_command(room: _Room, command: AuthorityCommand) -> AuthorityResult:
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
        if participant.seat_index != 0:
            raise AuthorityError("host_required", 403, "Only the host can start the match")
        if len(room.participants) != room.max_participants or not all(item.ready for item in room.participants):
            raise AuthorityError("players_not_ready", 409, "All participants must be ready")

        room.phase = "playing"
        room.match = _Match(
            current_turn=0,
            turn_deadline_at=None,
            top_cards=[None] * len(room.participants),
        )
        _flip_next(room, command.now_ms)
        room.revision += 1
        return _result_for_verifier(room, command.credential_verifier)

    if isinstance(command, AdvanceTurn):
        if room.phase != "playing" or room.match is None:
            raise AuthorityError("match_not_running", 409, "Match is not running")
        if room.match.bell_fruit is not None:
            raise AuthorityError("bell_window_open", 409, "Bell window is still open")
        if room.match.turn_deadline_at is None or command.now_ms < room.match.turn_deadline_at:
            raise AuthorityError("deadline_not_due", 409, "Turn deadline is not due")
        _flip_next(room, command.now_ms)
        room.revision += 1
        return _result_for_verifier(room, room.participants[0].credential_verifier)

    if isinstance(command, Bell):
        participant = _participant_for_verifier(room, command.credential_verifier)
        if room.phase != "playing" or room.match is None:
            raise AuthorityError("match_not_running", 409, "Match is not running")
        if room.match.bell_fruit is None:
            raise AuthorityError("wrong_bell", 409, "Bell is not available")

        collected_count = sum(card is not None for card in room.match.top_cards)
        room.match.result = _MatchResult(
            winner_seat_index=participant.seat_index,
            score=120 + collected_count * 6,
        )
        room.match.turn_deadline_at = None
        room.match.bell_fruit = None
        room.phase = "post_match"
        room.revision += 1
        return _result_for_verifier(room, command.credential_verifier)

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

    seat_index = len(room.participants)
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
                    pipeline.expire(room_key, ROOM_TTL_SECONDS)
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
                    pipeline.expire(room_key, ROOM_TTL_SECONDS)
                    await pipeline.execute()
                    return result
            except WatchError:
                continue
        raise AuthorityError("concurrent_update", 409, "Room changed while joining")

    async def _execute_room_command(
        self,
        room_code: str,
        command: Ready | Start | Bell | AdvanceTurn,
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
                    pipeline.expire(room_key, ROOM_TTL_SECONDS)
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
