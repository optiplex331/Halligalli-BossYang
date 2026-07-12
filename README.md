<p align="center">
  <img src="apps/web/public/icon.svg" width="96" height="96" alt="Halligalli Arena icon" />
</p>

# Halligalli Arena

Halligalli Arena is a bilingual exact-five card-reaction game. The current
product slice delivers the complete browser-local Single-Player Path plus a
two-through-six-seat FastAPI/Redis authoritative match.

It is a Product Monorepo with two application owners. The Web application keeps
all active round state in memory and preserves only normalized presentation
preferences in browser storage. The API owns ephemeral Redis room state and
the two-through-six-seat ready/start/turn/bell/result path, including the
shared scoring ledger and stable Seat Indexes.

## Start the Web application

```bash
node --version       # v24.x
pnpm --version       # 11.x
pnpm install
pnpm run dev         # Web on http://localhost:5173
HALLIGALLI_REDIS_URL=redis://localhost:6379/0 pnpm run dev:api
```

The root `dev` command deliberately starts focused Web development in this
slice. `compose.yaml` records the future Web/API/Redis ownership shape; the
clean three-service local path arrives in ticket 25.

## Checks

```bash
pnpm run test
pnpm run typecheck
pnpm run build
pnpm run check
```

## Current game behavior

- 72-card Halligalli inventory: banana, strawberry, lemon, and grape.
- Two through six browser-local seats with clockwise flips and top-card-only
  totals.
- Multiplayer rooms have six stable slots and use one authority-owned,
  deterministic 72-card sequence for two through six occupied Seats.
- Ring only when one fruit totals exactly five; a correct ring collects the
  table, while a wrong ring pays ceiling-half of the table cards.
- Easy, Normal, and Boss difficulties; 45/60/90-second rounds; button and
  Space-bar bell input.
- Chinese and English copy, document language updates, live announcements,
  keyboard focus, 44 px mobile controls, and reduced-motion coverage.
- Per-transition score floor and score-breakdown ledger, so absorbed penalties
  never become hidden debt.

The release characterization and exact fixture handoff are in
[docs/baselines/v0.6.0-behavior-contract.md](docs/baselines/v0.6.0-behavior-contract.md).

## Storage and privacy

`halligalli_settings` is the only Halligalli browser key retained by this
product slice. It stores normalized language, sound, difficulty, duration, and
player-count preferences. Historical best/recent results, history, trends,
daily goals, and achievements are removed on load and are never written again.

There are no accounts, payments, durable match records, player profiles, or
room recovery. The Multiplayer Authority uses ephemeral Redis state.

## Project shape

```text
apps/
├── web/                    # React/Vite Single-Player Path
└── api/                    # FastAPI REST/WebSocket + Redis authority
contracts/
├── fixtures/               # Versioned language-neutral behavior data
└── openapi.json            # Pydantic-generated REST contract snapshot
tests/
└── e2e/                    # Future cross-Web/API browser journeys
compose.yaml                # Future Web + API + Redis local ownership shape
```

`contracts/` is data only. The TypeScript browser rules and Python authority
consume the same JSON fixtures independently; they never share an executable
rules package.

## Boundaries

- React, Vite, TypeScript, and plain CSS belong to `apps/web`.
- FastAPI, Redis, REST, and native WebSocket work belong to `apps/api`.
- The old Node.js/socket.io standalone runtime is not retained as a fallback.
- Cloud desired state, Helm charts, Terraform, credentials, and operations stay
  in the infrastructure repository.

## Known release follow-up

The checked-in `container.yml` still describes the historical single-image
publication path. It is intentionally not made to pass with a standalone Docker
compatibility layer; the paired Web/API release rewrite is owned by ticket 27.

See [CONTRIBUTING.md](CONTRIBUTING.md) for local contribution guidance and
[SECURITY.md](SECURITY.md) for security reporting.
