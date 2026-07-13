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

## Local development

```bash
node --version       # v24.x
pnpm --version       # 11.12.0
pnpm install
pnpm run dev         # Web, API, Redis; open http://localhost:5173
```

Compose exposes only the Web on `http://localhost:5173`. Vite proxies `/api/v1`
and `/ws/v1` to the internal API, so browser traffic remains same-origin. Room
state belongs only to the disposable Redis container; Compose commits neither
credentials nor a data volume.

For focused host-process work, run `pnpm run dev:web` or set
`HALLIGALLI_REDIS_URL=redis://localhost:6379/0` and run `pnpm run dev:api`.
Stop the local stack with `pnpm run dev:down`.

## Checks

```bash
pnpm run test
pnpm run typecheck
pnpm run build
pnpm run check
pnpm run test:e2e    # after pnpm run dev; includes two-seat, six-seat, reconnect, and sequential-room journeys
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
└── e2e/                    # Cross-Web/API Compose journeys
compose.yaml                # Web + API + Redis local development stack
```

`contracts/` is data only. The TypeScript browser rules and Python authority
consume the same JSON fixtures independently; they never share an executable
rules package.

The Web image installs its build dependencies, including React and ReactDOM,
before Vite produces `dist/`. Its nginx runtime contains only that generated
static output, so these browser-bundle packages are development dependencies
rather than Node.js runtime dependencies.

## Boundaries

- React, Vite, TypeScript, and plain CSS belong to `apps/web`.
- FastAPI, Redis, REST, and native WebSocket work belong to `apps/api`.
- The old Node.js/socket.io standalone runtime is not retained as a fallback.
- Cloud desired state, Helm charts, Terraform, credentials, and operations stay
  in the infrastructure repository.

## Paired releases

A Release Tag builds `halligalli-web` and `halligalli-api` from the same commit.
The release workflow scans both non-root images, checks their shared runtime
identity through a local paired smoke, then publishes one schema-V2
`release-attestation.json` containing both immutable digests. The product
repository never selects Infrastructure GitOps state or carries an
Infrastructure write credential.

See [CONTRIBUTING.md](CONTRIBUTING.md) for local contribution guidance and
[SECURITY.md](SECURITY.md) for security reporting.
