# Game-day report: Redis restart on Compose

- Date: 2026-09-27 (times below are UTC)
- Environment: local Docker Compose (`docker compose -p hg10`), Product commit `a5a9053`
- Scope: local only; no Live Demo, Azure, Kubernetes, or Terraform involvement
- Outcome: all rooms are lost, as expected for ephemeral Redis. The API's background loops
  recover within about 1 s, and new rooms work immediately. Players in a lost room are not
  told: their socket stays open and silent, and the Web client then retries a closed room
  forever. This is a product bug, described below.

## Setup

- Stack: `docker compose -p hg10 up -d`. Redis runs `redis:8.0.1-alpine` with
  `--save '' --appendonly no`, so a restart starts empty.
- Load: `node tests/load/harness.mjs --step-seconds 60 --runtime-summary-file <file>`, with
  the API log stream appended to that file. At the fault the harness was in
  `ramp-5-rooms`: 55 rooms in Redis and 18 sockets open.
- Probe: the same ad hoc two-player client used in the API kill drill. It follows the Web
  reconnect policy, readies, starts, and continues matches, and does not ring.
- Focused check after the drill: a second ad hoc script created a room, started a match,
  restarted Redis, and then sent `bell` and `leave` on the old sockets. It also
  re-authenticated, read the room over REST, and created a new room.

## Commands

```sh
docker compose -p hg10 restart redis
```

## Timeline

| Time | Event |
|---|---|
| 03:43:26 | Harness and probe start |
| 03:45:30 | Probe match 2 starts |
| 03:45:50 | Last summary before the fault: 55 rooms, 18 sockets, tick p95 129 ms, 98 samples |
| 03:45:56 | `restart redis` issued |
| 03:45:57.5 | Redis `Ready to accept connections` (empty) |
| 03:45:56–58 | API logs `due deadline loop failed; restarting` and `revision forwarder failed; restarting` (one each), plus 3 × `Exception in ASGI application` |
| 03:46:02 | Harness aborts |
| 03:46:05 | Summary: 0 rooms, 2 sockets, tick p95 106 ms (samples from before the fault) |
| 03:46:20–03:48:20 | Every summary: 0 rooms, **2 sockets**, 0 tick samples |
| 03:48:27 | Probe ends. Its sockets never closed and never received a frame after the fault |

## Observed behavior

### Harness

Aborted with `client error rate exceeded 2%`, 2.05% (5/244). Reasons:
`unexpected socket close 1006` (3) and `bell response timeout` (2). Up to the fault, the
steps were within budget (server tick p95 below 130 ms).

### API

- `supervise()` restarted the due deadline loop and the revision forwarder once each,
  after 1 s, and neither failed again. The due loop works afterwards: a room created
  after the restart revealed 6 cards in its first 6 s. With one API replica, the
  forwarder only re-sends revisions that were already published directly, so this drill
  cannot prove that it resumed delivering. It did re-subscribe without logging an error.
- The three `Exception in ASGI application` tracebacks are `redis.exceptions.ConnectionError`
  (`Connection reset by peer`, then `Error 111 connecting to redis:6379. Connection refused`).
  They were raised from `authority.execute` inside the WebSocket command loop. Only
  `AuthorityError` and `ValidationError` are handled there, so the socket drops without a
  close frame. The harness saw these drops as 1006 closes.
- `active_sockets` stayed at 2 for the rest of the run. These were the probe's sockets,
  still attached to a room that no longer exists.

### Lost-room handling (focused check)

| Step | Result |
|---|---|
| 3 s after Redis is back, old sockets | Both still `OPEN`; no frame received |
| `bell` on an old socket | Socket closed with **1008** within 11 ms. No `error` frame first |
| `leave` on the other old socket | Closed with 1008. No `error` frame |
| REST `GET /api/v1/rooms/{room}` with the old credential | `404 room_not_found` |
| New socket, authenticate with the old credential | Closed with 1008 |
| Create a new room | Works; match plays normally |

## Product bug: players in a lost room are never told

A room lost with Redis leaves its players stuck. There is no in-app sign that the room is
gone.

1. Server: `RoomSocketHub` detaches a socket only when `publish()` gets an `AuthorityError`
   (`apps/api/src/halligalli_api/app.py`, `RoomSocketHub.publish`). A vanished room is no
   longer in the due index and receives no commands, so nothing publishes for it. Its
   sockets stay open and silent indefinitely. Evidence: probe sockets open for 150 s with
   no frames, and `active_sockets: 2` with `active_rooms: 0` in every later summary.
2. Server: when a player does act, the command gets `room_not_found`, which is in
   `_SOCKET_CLOSING_ERRORS`. The socket closes with 1008 and no `error` frame, so the
   client never receives the code.
3. Web (from code; not driven in a browser here): `reconnectAfterClose` in
   `apps/web/src/multiplayer/socket-protocol.ts` treats every close except 1012 as
   retryable, and `room-entry.ts` retries forever with backoff capped at 5 s. Each retry
   authenticates, gets 1008, and schedules the next. The UI shows "Connecting to room…"
   (`roomConnecting`) and never shows `errorRoomNotFound`.

Player impact: the table freezes mid-match while the page still looks connected. After
pressing the bell, the player sees "Connecting to room…" indefinitely and has to reload or
leave the room. ADR decisions accept losing the room itself (no room recovery in V1); the
missing notice is the defect.

## Secondary defect: Redis errors in the command loop are unhandled

A Redis `ConnectionError` during a WebSocket command escapes the handler as an
ASGI exception. The connection drops without a close code, and the full traceback is
logged. The Web client reconnects after a 1006, so the player impact is a short reconnect.
The cost is log noise and the missing structured error.

## What a player would experience

- In a room that existed before the restart: the table stops moving. Nothing appears for
  as long as the player waits. A bell press or leave turns it into an endless "Connecting
  to room…". Scores and the match are gone.
- A player who rang during the restart itself may briefly see a reconnect, and their bell
  gets no answer.
- New rooms created after the restart work normally.

## Follow-ups

1. Fix the lost-room notice (bug above). One option: when a socket's room cannot be loaded,
   send an `error` frame with `room_not_found` before closing with 1008, and close silent
   sockets whose room has vanished. On the Web side, treat 1008 or `room_not_found` as
   terminal and return the player to room entry with the existing `errorRoomNotFound` copy.
2. Handle `redis.exceptions.RedisError` in the WebSocket command loop: answer with a
   retryable error or close with 1011, instead of letting the exception escape.
3. Harness: in a drill mode, classify closes caused by the fault separately from client
   errors, as suggested in the API kill report.

## Follow-up disposition (2026-09-28)

These later statuses do not change the Compose observations above.

1. **Resolved in `v0.10.1`.** The revision forwarder republishes attached rooms after
   reconnecting, so a missing room is reported to the socket and the Web stops retrying
   on the terminal close. See `apps/api/src/halligalli_api/app.py`,
   `apps/api/tests/test_socket_hub.py`, and
   `apps/web/src/__tests__/lifecycle.test.ts`.
2. **Resolved in `v0.10.1`.** Redis connection and timeout failures become the
   retryable `authority_unavailable` frame; the socket remains usable. See
   `apps/api/src/halligalli_api/authority.py` and
   `apps/api/tests/test_websocket_match.py`.
3. **Partly resolved.** The load harness reconnects and records planned `1012` restart
   closes for the K3s drill. Other closes, including fault-related `1006`, remain client
   errors; a Redis-restart fault mode is still unimplemented. The planned-restart result
   is recorded in the [K3s rollback evidence](https://github.com/optiplex331/Halligalli-infrastructure/blob/main/targets/k3s/evidence/rollback-drill-2026-09-27.md).
