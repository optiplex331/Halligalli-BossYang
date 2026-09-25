from __future__ import annotations

import os
import asyncio
import json
import logging
import time
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass
from inspect import isawaitable
from pathlib import Path
from typing import Annotated, Literal
from uuid import UUID

from fastapi import FastAPI, Header, Request, WebSocket, WebSocketDisconnect
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from pydantic import ConfigDict, Field, ValidationError

from .authority import (
    ApiModel,
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
    RedisRevisionSubscription,
    RoomSnapshot,
    Start,
    Viewer,
    credential_verifier,
)
from .observability import Telemetry, elapsed_since


_logger = logging.getLogger("halligalli.api")
# Only a credential that no longer authenticates or a room that no longer exists ends the socket.
_SOCKET_CLOSING_ERRORS = frozenset({"credential_invalid", "room_not_found"})
_RELEASE_IDENTITY_PATH = Path(__file__).with_name("release-identity.json")


def _load_release_identity() -> dict[str, str]:
    identity = json.loads(_RELEASE_IDENTITY_PATH.read_text(encoding="utf-8"))
    if (
        not isinstance(identity, dict)
        or not isinstance(identity.get("version"), str)
        or not isinstance(identity.get("commit"), str)
    ):
        raise RuntimeError("Release identity must contain string version and commit values")
    return {"version": identity["version"], "commit": identity["commit"]}


class EntryRequest(ApiModel):
    name: str = Field(min_length=1, max_length=24, pattern=r"^[^\r\n]+$")
    credential_verifier: str = Field(pattern=r"^[a-f0-9]{64}$")


class CreateRoomRequest(EntryRequest):
    model_config = ConfigDict(extra="forbid")

    table_seat_count: int = Field(ge=4, le=8)
    target_human_participant_count: int = Field(ge=2)
    difficulty: Literal["easy", "normal", "hard"]
    duration_sec: int | None = Field(
        default=None,
        deprecated=True,
        description="Ignored. Accepted for one release so pages loaded before its removal can still create rooms.",
    )


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


@dataclass
class _SocketMember:
    credential: str
    revision: int


class RoomSocketHub:
    def __init__(self) -> None:
        self._members: dict[str, dict[WebSocket, _SocketMember]] = {}

    def attach(self, room_code: str, websocket: WebSocket, credential: str, revision: int) -> None:
        self._members.setdefault(room_code, {})[websocket] = _SocketMember(credential, revision)

    def detach(self, room_code: str, websocket: WebSocket) -> None:
        members = self._members.get(room_code)
        if members is None:
            return
        members.pop(websocket, None)
        if not members:
            self._members.pop(room_code, None)

    async def publish(self, room_code: str, authority: MultiplayerAuthority) -> None:
        members = list(self._members.get(room_code, {}).items())
        for websocket, member in members:
            try:
                snapshot = await authority.snapshot(room_code, Viewer(credential=member.credential))
            except AuthorityError:
                self.detach(room_code, websocket)
                continue
            if snapshot.revision <= member.revision:
                continue
            member.revision = snapshot.revision
            try:
                await websocket.send_json(
                    {"type": "snapshot", "snapshot": snapshot.model_dump(by_alias=True)},
                )
            except Exception:
                # A peer that can no longer receive is gone; it must not break the publisher.
                self.detach(room_code, websocket)


async def forward_room_revisions(
    room_codes: AsyncIterator[str],
    hub: RoomSocketHub,
    authority: MultiplayerAuthority,
) -> None:
    async for room_code in room_codes:
        await hub.publish(room_code, authority)


def _runtime_authority(telemetry: Telemetry) -> RedisMultiplayerAuthority:
    return RedisMultiplayerAuthority.from_url(
        os.environ.get("HALLIGALLI_REDIS_URL", "redis://redis:6379/0"),
        telemetry=telemetry,
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


def _room_command(payload: WebSocketRoomCommand, credential: str, now_ms: int):
    verifier = credential_verifier(credential)
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


async def supervise(name: str, run: Callable[[], Awaitable[None]], *, restart_delay_seconds: float = 1.0) -> None:
    """Keep a background loop alive, restarting it after unexpected failures."""
    while True:
        try:
            await run()
            return
        except asyncio.CancelledError:
            raise
        except Exception:
            _logger.exception("%s failed; restarting", name)
            await asyncio.sleep(restart_delay_seconds)


def create_app(
    authority: MultiplayerAuthority | None = None,
    *,
    due_interval_seconds: float = 0.1,
    startup_timeout_seconds: float = 10.0,
) -> FastAPI:
    build_identity = _load_release_identity()
    telemetry = Telemetry()
    selected_authority = authority or _runtime_authority(telemetry)
    hub = RoomSocketHub()

    async def advance_due_rooms() -> None:
        while True:
            for room_code in await selected_authority.advance_due():
                await hub.publish(room_code, selected_authority)
            await asyncio.sleep(due_interval_seconds)

    ready_subscriptions: list[RedisRevisionSubscription] = []

    async def forward_revisions() -> None:
        # The first run uses the subscription made during startup; restarts subscribe again.
        subscription = ready_subscriptions.pop() if ready_subscriptions else await selected_authority.subscribe_revisions()
        try:
            await forward_room_revisions(subscription.events(), hub, selected_authority)
        finally:
            await subscription.aclose()

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        if isinstance(selected_authority, RedisMultiplayerAuthority):
            # An unreachable Redis at startup fails the process so the platform restarts it.
            ready_subscriptions.append(
                await asyncio.wait_for(selected_authority.subscribe_revisions(), timeout=startup_timeout_seconds),
            )
        tasks = [asyncio.create_task(supervise("due deadline loop", advance_due_rooms))]
        if ready_subscriptions:
            tasks.append(asyncio.create_task(supervise("revision forwarder", forward_revisions)))
        try:
            yield
        finally:
            for task in tasks:
                task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)
            close = getattr(selected_authority, "aclose", None)
            if close is not None:
                await close()
            telemetry.shutdown()

    app = FastAPI(
        title="Halligalli API",
        version="0.1.0",
        description="Ephemeral multiplayer room entry and viewer snapshots.",
        lifespan=lifespan,
    )
    app.state.authority = selected_authority
    app.state.room_socket_hub = hub
    app.state.telemetry = telemetry

    @app.middleware("http")
    async def record_http(request: Request, call_next):
        with telemetry.span("http.request") as span:
            trace_id = telemetry.trace_id(span)
            started_at = time.perf_counter()
            try:
                response = await call_next(request)
            except Exception:
                telemetry.record_http(
                    trace_id=trace_id,
                    method=request.method,
                    route=request.url.path,
                    status_code=500,
                    elapsed_seconds=elapsed_since(started_at),
                    span=span,
                )
                raise
            route = request.scope.get("route")
            telemetry.record_http(
                trace_id=trace_id,
                method=request.method,
                route=getattr(route, "path", request.url.path),
                status_code=response.status_code,
                elapsed_seconds=elapsed_since(started_at),
                span=span,
            )
            response.headers["X-Trace-Id"] = trace_id
            return response

    async def active_room_count() -> int:
        count = getattr(selected_authority, "active_room_count", None)
        if count is None:
            return 0
        result = count()
        return await result if isawaitable(result) else result

    @app.get("/internal/identity", include_in_schema=False)
    async def release_identity() -> dict[str, str]:
        return dict(build_identity)

    @app.get("/internal/ready", include_in_schema=False)
    async def readiness() -> JSONResponse:
        check = getattr(selected_authority, "readiness", None)
        ready = True if check is None else await check()
        return JSONResponse({"ready": ready}, status_code=200 if ready else 503)

    @app.get("/internal/metrics", include_in_schema=False)
    async def metrics() -> Response:
        return Response(
            content=telemetry.metrics(active_rooms=await active_room_count()),
            media_type="text/plain; version=0.0.4",
        )

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
        request: CreateRoomRequest,
        idempotency_key: Annotated[UUID, Header(alias="Idempotency-Key")],
    ) -> EntryResult:
        return await app.state.authority.execute(
            None,
            CreateRoom(
                idempotency_key=str(idempotency_key),
                name=request.name.strip(),
                credential_verifier=request.credential_verifier,
                table_seat_count=request.table_seat_count,
                target_human_participant_count=request.target_human_participant_count,
                difficulty=request.difficulty,
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

    def record_client_error(
        room_code: str,
        command: str,
        trace_id: str = "",
        started_at: float | None = None,
        span: object | None = None,
    ) -> None:
        telemetry.record_websocket(
            trace_id=trace_id,
            room_code=room_code,
            command=command,
            outcome="client_error",
            elapsed_seconds=elapsed_since(started_at) if started_at is not None else 0,
            span=span,
        )

    @app.websocket("/ws/v1/rooms/{room_code}")
    async def room_websocket(websocket: WebSocket, room_code: str) -> None:
        await websocket.accept()
        canonical_room_code = _canonical_room_code(room_code)
        try:
            with telemetry.span("websocket.command") as span:
                trace_id = telemetry.trace_id(span)
                started_at = time.perf_counter()
                payload = WebSocketAuthentication.model_validate_json(await websocket.receive_text())
                snapshot = await app.state.authority.snapshot(
                    canonical_room_code,
                    Viewer(credential=payload.credential),
                )
                telemetry.record_websocket(
                    trace_id=trace_id,
                    room_code=canonical_room_code,
                    command="authenticate",
                    outcome="success",
                    elapsed_seconds=elapsed_since(started_at),
                    span=span,
                )
        except (AuthorityError, ValidationError):
            record_client_error(canonical_room_code, "authenticate")
            await websocket.close(code=1008)
            return
        except WebSocketDisconnect:
            return

        await websocket.send_json(
            {"type": "snapshot", "snapshot": snapshot.model_dump(by_alias=True)},
        )
        hub.attach(canonical_room_code, websocket, payload.credential, snapshot.revision)
        try:
            while True:
                message = await websocket.receive_text()
                with telemetry.span("websocket.command") as span:
                    trace_id = telemetry.trace_id(span)
                    started_at = time.perf_counter()
                    try:
                        command_payload = WebSocketRoomCommand.model_validate_json(message)
                    except ValidationError:
                        record_client_error(canonical_room_code, "command", trace_id, started_at, span)
                        await websocket.send_json({"type": "error", "code": "invalid_request", "title": "Command is invalid"})
                        continue
                    command_name = command_payload.type
                    try:
                        await app.state.authority.execute(
                            canonical_room_code,
                            _room_command(command_payload, payload.credential, app.state.authority.now_ms()),
                        )
                    except AuthorityError as error:
                        record_client_error(canonical_room_code, command_name, trace_id, started_at, span)
                        if error.code in _SOCKET_CLOSING_ERRORS:
                            await websocket.close(code=1008)
                            return
                        await websocket.send_json({"type": "error", "code": error.code, "title": error.title})
                        continue
                    await hub.publish(canonical_room_code, app.state.authority)
                    telemetry.record_websocket(
                        trace_id=trace_id,
                        room_code=canonical_room_code,
                        command=command_name,
                        outcome="success",
                        elapsed_seconds=elapsed_since(started_at),
                        span=span,
                    )
        except WebSocketDisconnect:
            pass
        finally:
            hub.detach(canonical_room_code, websocket)

    return app


app = create_app()


__all__ = ["app", "create_app"]
