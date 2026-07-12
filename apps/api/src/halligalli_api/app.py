from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import Annotated, Literal
from uuid import UUID

from fastapi import FastAPI, Header, Request, WebSocket, WebSocketDisconnect
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import Field

from .authority import (
    ApiModel,
    AuthorityError,
    CreateRoom,
    EntryResult,
    JoinRoom,
    MultiplayerAuthority,
    RedisMultiplayerAuthority,
    RoomSnapshot,
    Viewer,
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


def create_app(authority: MultiplayerAuthority | None = None) -> FastAPI:
    selected_authority = authority or _runtime_authority()

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        yield
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
        try:
            payload = WebSocketAuthentication.model_validate(await websocket.receive_json())
            snapshot = await app.state.authority.snapshot(
                _canonical_room_code(room_code),
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

    return app


app = create_app()


__all__ = ["app", "create_app"]
