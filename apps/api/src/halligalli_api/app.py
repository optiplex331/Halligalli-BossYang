from __future__ import annotations

import os
import asyncio
import time
from contextlib import asynccontextmanager
from typing import Annotated, Literal
from uuid import UUID

from fastapi import FastAPI, Header, Request, WebSocket, WebSocketDisconnect
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import Field

from .authority import (
    ApiModel,
    AdvanceTurn,
    AdvancePostMatch,
    AuthorityError,
    Bell,
    CreateRoom,
    EntryResult,
    ContinueMatch,
    Forfeit,
    JoinRoom,
    MultiplayerAuthority,
    Ready,
    Leave,
    RedisMultiplayerAuthority,
    RoomSnapshot,
    Start,
    Viewer,
    credential_verifier,
)


class EntryRequest(ApiModel):
    name: str = Field(min_length=1, max_length=24, pattern=r"^[^\r\n]+$")
    credential_verifier: str = Field(pattern=r"^[a-f0-9]{64}$")


class ProblemDetails(ApiModel):
    type: str
    title: str
    status: int
    code: str


class WebSocketAuthentication(ApiModel):
    type: Literal["authenticate"]
    credential: str = Field(min_length=1)


class WebSocketRoomCommand(ApiModel):
    type: Literal["ready", "start", "bell", "leave", "forfeit", "continue", "post_match_leave"]
    command_id: str | None = Field(default=None, min_length=1, max_length=64)


class RoomSocketHub:
    def __init__(self) -> None:
        self._members: dict[str, dict[WebSocket, str]] = {}

    def attach(self, room_code: str, websocket: WebSocket, credential: str) -> None:
        self._members.setdefault(room_code, {})[websocket] = credential

    def detach(self, room_code: str, websocket: WebSocket) -> None:
        members = self._members.get(room_code)
        if members is None:
            return
        members.pop(websocket, None)
        if not members:
            self._members.pop(room_code, None)

    async def publish(self, room_code: str, authority: MultiplayerAuthority) -> None:
        members = list(self._members.get(room_code, {}).items())
        for websocket, credential in members:
            try:
                snapshot = await authority.snapshot(room_code, Viewer(credential=credential))
                await websocket.send_json(
                    {"type": "snapshot", "snapshot": snapshot.model_dump(by_alias=True)},
                )
            except (AuthorityError, RuntimeError):
                self.detach(room_code, websocket)


def _runtime_authority() -> RedisMultiplayerAuthority:
    return RedisMultiplayerAuthority.from_url(
        os.environ.get("HALLIGALLI_REDIS_URL", "redis://redis:6379/0"),
    )


def _canonical_room_code(room_code: str) -> str:
    return room_code.upper()


def _viewer_from_authorization(authorization: str | None) -> Viewer:
    if authorization is None or not authorization.startswith("Bearer "):
        raise AuthorityError("credential_invalid", 401, "Participant credential is required")
    credential = authorization.removeprefix("Bearer ").strip()
    if not credential:
        raise AuthorityError("credential_invalid", 401, "Participant credential is required")
    return Viewer(credential=credential)


def _room_command(payload: WebSocketRoomCommand, credential: str):
    verifier = credential_verifier(credential)
    now_ms = time.time_ns() // 1_000_000
    if payload.type == "ready":
        return Ready(verifier, payload.command_id)
    if payload.type == "start":
        return Start(verifier, now_ms=now_ms, command_id=payload.command_id)
    if payload.type == "bell":
        return Bell(verifier, now_ms=now_ms, command_id=payload.command_id)
    if payload.type == "leave":
        return Leave(verifier, payload.command_id)
    if payload.type == "forfeit":
        return Forfeit(verifier, now_ms=now_ms, command_id=payload.command_id)
    return ContinueMatch(verifier, payload.type == "continue", payload.command_id)


def create_app(authority: MultiplayerAuthority | None = None) -> FastAPI:
    selected_authority = authority or _runtime_authority()
    hub = RoomSocketHub()
    deadline_tasks: set[asyncio.Task[None]] = set()

    def schedule_turn(room_code: str, deadline_at: int) -> None:
        async def advance_when_due() -> None:
            delay_seconds = max(0, deadline_at - (time.time_ns() // 1_000_000)) / 1_000
            await asyncio.sleep(delay_seconds)
            try:
                result = await selected_authority.execute(
                    room_code,
                    AdvanceTurn(now_ms=time.time_ns() // 1_000_000),
                )
            except AuthorityError:
                return
            await hub.publish(room_code, selected_authority)
            if result.snapshot.phase == "playing" and result.snapshot.turn_deadline_at is not None:
                schedule_turn(room_code, result.snapshot.turn_deadline_at)
            elif result.snapshot.phase == "post_match" and result.snapshot.post_match_deadline_at is not None:
                schedule_post_match(room_code, result.snapshot.post_match_deadline_at)

        task = asyncio.create_task(advance_when_due())
        deadline_tasks.add(task)
        task.add_done_callback(deadline_tasks.discard)

    def schedule_post_match(room_code: str, deadline_at: int) -> None:
        async def close_when_due() -> None:
            delay_seconds = max(0, deadline_at - (time.time_ns() // 1_000_000)) / 1_000
            await asyncio.sleep(delay_seconds)
            try:
                await selected_authority.execute(
                    room_code,
                    AdvancePostMatch(now_ms=time.time_ns() // 1_000_000, command_id=f"deadline:{deadline_at}"),
                )
            except AuthorityError:
                return
            await hub.publish(room_code, selected_authority)

        task = asyncio.create_task(close_when_due())
        deadline_tasks.add(task)
        task.add_done_callback(deadline_tasks.discard)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        yield
        pending_tasks = tuple(deadline_tasks)
        for task in pending_tasks:
            task.cancel()
        if pending_tasks:
            await asyncio.gather(*pending_tasks, return_exceptions=True)
        close = getattr(selected_authority, "aclose", None)
        if close is not None:
            await close()

    app = FastAPI(
        title="Halligalli API",
        version="0.1.0",
        description="Ephemeral multiplayer room entry and viewer snapshots.",
        lifespan=lifespan,
    )
    app.state.authority = selected_authority
    app.state.room_socket_hub = hub

    @app.exception_handler(AuthorityError)
    async def authority_error_handler(_: Request, error: AuthorityError) -> JSONResponse:
        problem = ProblemDetails(
            type=f"https://halligalli.games/problems/{error.code}",
            title=error.title,
            status=error.status_code,
            code=error.code,
        )
        return JSONResponse(
            status_code=error.status_code,
            content=problem.model_dump(by_alias=True),
            media_type="application/problem+json",
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(_: Request, __: RequestValidationError) -> JSONResponse:
        problem = ProblemDetails(
            type="https://halligalli.games/problems/invalid_request",
            title="Request is invalid",
            status=422,
            code="invalid_request",
        )
        return JSONResponse(
            status_code=422,
            content=problem.model_dump(by_alias=True),
            media_type="application/problem+json",
        )

    @app.post(
        "/api/v1/rooms",
        response_model=EntryResult,
        status_code=201,
        responses={
            401: {"model": ProblemDetails},
            409: {"model": ProblemDetails},
            422: {"model": ProblemDetails},
        },
    )
    async def create_room(
        request: EntryRequest,
        idempotency_key: Annotated[UUID, Header(alias="Idempotency-Key")],
    ) -> EntryResult:
        return await app.state.authority.execute(
            None,
            CreateRoom(
                idempotency_key=str(idempotency_key),
                name=request.name.strip(),
                credential_verifier=request.credential_verifier,
            ),
        )

    @app.post(
        "/api/v1/rooms/{room_code}/participants",
        response_model=EntryResult,
        status_code=201,
        responses={
            401: {"model": ProblemDetails},
            404: {"model": ProblemDetails},
            409: {"model": ProblemDetails},
            422: {"model": ProblemDetails},
        },
    )
    async def join_room(
        room_code: str,
        request: EntryRequest,
        idempotency_key: Annotated[UUID, Header(alias="Idempotency-Key")],
    ) -> EntryResult:
        canonical_room_code = _canonical_room_code(room_code)
        return await app.state.authority.execute(
            canonical_room_code,
            JoinRoom(
                idempotency_key=str(idempotency_key),
                name=request.name.strip(),
                credential_verifier=request.credential_verifier,
            ),
        )

    @app.get(
        "/api/v1/rooms/{room_code}",
        response_model=RoomSnapshot,
        responses={401: {"model": ProblemDetails}, 404: {"model": ProblemDetails}, 422: {"model": ProblemDetails}},
    )
    async def get_room_snapshot(
        room_code: str,
        authorization: Annotated[str | None, Header()] = None,
    ) -> RoomSnapshot:
        return await app.state.authority.snapshot(
            _canonical_room_code(room_code),
            _viewer_from_authorization(authorization),
        )

    @app.websocket("/ws/v1/rooms/{room_code}")
    async def room_websocket(websocket: WebSocket, room_code: str) -> None:
        await websocket.accept()
        canonical_room_code = _canonical_room_code(room_code)
        try:
            payload = WebSocketAuthentication.model_validate(await websocket.receive_json())
            snapshot = await app.state.authority.snapshot(
                canonical_room_code,
                Viewer(credential=payload.credential),
            )
        except (AuthorityError, ValueError):
            await websocket.close(code=1008)
            return
        except WebSocketDisconnect:
            return

        await websocket.send_json(
            {"type": "snapshot", "snapshot": snapshot.model_dump(by_alias=True)},
        )
        hub.attach(canonical_room_code, websocket, payload.credential)
        try:
            while True:
                command_payload = WebSocketRoomCommand.model_validate(await websocket.receive_json())
                result = await app.state.authority.execute(
                    canonical_room_code,
                    _room_command(command_payload, payload.credential),
                )
                await hub.publish(canonical_room_code, app.state.authority)
                if command_payload.type == "start" and result.snapshot.turn_deadline_at is not None:
                    schedule_turn(canonical_room_code, result.snapshot.turn_deadline_at)
                if result.snapshot.phase == "post_match" and result.snapshot.post_match_deadline_at is not None:
                    schedule_post_match(canonical_room_code, result.snapshot.post_match_deadline_at)
        except (AuthorityError, ValueError):
            await websocket.close(code=1008)
        except WebSocketDisconnect:
            pass
        finally:
            hub.detach(canonical_room_code, websocket)

    return app


app = create_app()


__all__ = ["app", "create_app"]
