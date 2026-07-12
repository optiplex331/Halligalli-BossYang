# Halligalli API

This package owns FastAPI transport and the Redis-backed Multiplayer Authority.
It currently delivers authenticated two-seat room entry plus the authority-owned
happy path: ready, host start, timed card progression, a valid bell, and an
ephemeral result. Score-breakdown parity and larger room sizes follow in later
slices.

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
