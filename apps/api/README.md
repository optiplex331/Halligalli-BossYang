# Halligalli API

This package owns FastAPI transport and the Redis-backed Multiplayer Authority.
It delivers authenticated four-through-eight-Table-Seat room entry plus the
authority-owned match path: ready, host start, timed card progression,
correct/wrong/missed bell windows, the shared score-breakdown ledger, stable
Seat Indexes, and an ephemeral result. Room Configuration independently fixes
the Table Seat count and target Human Participant count. A match starts only
when that exact target is present and ready.
While a match is active, the Authority advances one deterministic 72-card
inventory clockwise through every Table Seat, including Neutral Seats. Its
snapshots expose complete seat state, sparse Human Participants, viewer
capabilities, and participant-only scores/results.

Run the API against an ephemeral Redis instance with:

```bash
HALLIGALLI_REDIS_URL=redis://localhost:6379/0 pnpm run dev:api
```

Runtime and API behavior tests use `RedisMultiplayerAuthority`; set
`HALLIGALLI_TEST_REDIS_URL` to an isolated ephemeral Redis database when running
the API suite (for example,
`HALLIGALLI_TEST_REDIS_URL=redis://localhost:6379/0 pnpm run test:api`). REST
contract truth is generated from Pydantic
into `../../contracts/openapi.json`, and the Web consumes its generated REST
types. Participant Credentials are browser-memory secrets: callers submit only
their verifier on entry and use the raw credential later in an Authorization
header or the first native WebSocket frame.

WebSocket clients send only room and match intent frames. The
authority generates cards, deadlines, availability, score, and results, then
sends complete viewer-specific snapshots for the Web projection to render.

This package must not import Web source or browser APIs.

## Operational surfaces

The API writes JSON telemetry to stdout without request payloads, credentials, or
credential verifiers. `GET /internal/identity` exposes release version/commit,
`GET /internal/ready` checks traffic readiness, and `GET /internal/metrics`
exposes Prometheus text metrics for HTTP, WebSocket, Redis adapter operations,
and active rooms. These endpoints are internal operational surfaces, not Web
application routes.
