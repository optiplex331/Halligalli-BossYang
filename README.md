# Halligalli Arena

A browser Halligalli (exact-five bell) game. Rooms live on the server: one human can practice alone
against Neutral Seats (they flip cards but never ring or score), or 2-8 humans play together.
State is ephemeral and lives only in Redis.

## Components

- `apps/web`: React + Vite + TypeScript UI (Node 24, pnpm 11)
- `apps/api`: FastAPI REST and WebSocket server (Python 3.14, uv)
- Redis: all room state; a restart loses every room
- `contracts/openapi.json`: REST contract snapshot, mirrored by `apps/web/src/multiplayer/rest.generated.ts`

## Run locally

```sh
redis-server                      # or any Redis 8 on localhost:6379

cd apps/api && uv sync
uv run uvicorn halligalli_api.app:app --reload --port 8000 --ws-max-size 4096

cd apps/web && pnpm install
pnpm dev                          # http://localhost:5173
```

The browser talks only to its own origin; Vite proxies `/api` and `/ws` to the API.

| Port | Service |
| --- | --- |
| 5173 | Web (Vite) |
| 8000 | API |
| 6379 | Redis |

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `HALLIGALLI_REDIS_URL` | `redis://localhost:6379/0` | API Redis connection |
| `HALLIGALLI_TRUSTED_PROXY_HOPS` | `0` | Proxies whose `X-Forwarded-For` entry is trusted |
| `HALLIGALLI_API_ORIGIN` | `http://localhost:8000` | Where the Vite dev server proxies `/api` and `/ws` |
| `HALLIGALLI_TEST_REDIS_URL` | none | Redis for API tests (required; the database is flushed) |
| `HALLIGALLI_E2E_ORIGIN` | `http://localhost:5173` | Target of the e2e script |

## Tests

```sh
HALLIGALLI_TEST_REDIS_URL=redis://localhost:6379/15 uv run --project apps/api python -m unittest discover -s apps/api/tests
cd apps/web && pnpm test && pnpm typecheck && pnpm build
node tests/e2e/journeys.mjs       # with Redis, API and Vite running
```

`/internal/ready` returns 200 when Redis answers and 503 otherwise.

## Client bounds

- Client limits use the address found `HALLIGALLI_TRUSTED_PROXY_HOPS` entries from the right of
  `X-Forwarded-For`; `0` ignores the header and uses the TCP peer. Set it to the exact number of proxies
  in front of the API, otherwise all users share one budget or a forged header is trusted.
- Room creation costs one unit of a per-address budget of 480 rooms per hour (Redis counter); the next
  one returns `429 room_creation_limited`. Rematches stay in the same room and cost nothing.
- WebSocket messages over 4096 bytes close the socket with code 1009; run uvicorn with
  `--ws-max-size 4096` so oversized frames are refused before they are buffered.
- New rooms are refused when Redis memory use passes 80% of `maxmemory`.
