# Halligalli API

This package owns FastAPI transport and the Redis-backed Multiplayer Authority.
It currently delivers authenticated two-through-six-seat room entry plus the
authority-owned match path: ready, host start, timed card progression,
correct/wrong/missed bell windows, the shared score-breakdown ledger, stable
Seat Indexes, and an ephemeral result. A room has six stable slots and a match
starts once two through six current participants are all ready.
While a match is active, the Authority advances one deterministic 72-card
inventory clockwise through its occupied Seats; its snapshots expose the
Authority-owned minimum participant count alongside the room capacity.

Run the API against an ephemeral Redis instance with:

```bash
HALLIGALLI_REDIS_URL=redis://localhost:6379/0 pnpm run dev:api
```

The runtime selects `RedisMultiplayerAuthority`; `InMemoryMultiplayerAuthority`
exists only for interface tests. REST contract truth is generated from Pydantic
into `../../contracts/openapi.json`, and the Web consumes its generated REST
types. Participant Credentials are browser-memory secrets: callers submit only
their verifier on entry and use the raw credential later in an Authorization
header or the first native WebSocket frame.

WebSocket clients send only `ready`, `start`, and `bell` intent frames. The
authority generates cards, deadlines, availability, score, and results, then
sends complete viewer-specific snapshots for the Web projection to render.

This package must not import Web source or browser APIs.
