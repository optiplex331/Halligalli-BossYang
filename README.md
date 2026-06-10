# Halligalli Arena

A browser arena for Halligalli-style bell reactions: watch the top cards, spot exactly five matching fruits, and ring before the window closes.

Play solo to build reaction speed, or create a real-time room and race friends on a server-authoritative table.

**Live demo**: `https://play.halligalli.games` after external Azure/HCP Terraform/Name.com activation.

![Halligalli Arena gameplay](docs/assets/readme-hero.png)

## Highlights

- Physical-table rules: clockwise flips, top-card-only counting, exact-five bell windows.
- Skill training loop: reaction timing, accuracy, streaks, daily goals, achievements, and trend charts.
- Real-time multiplayer: room codes, ready lobby, first-valid-bell wins, and server-authoritative scoring.
- Boss Mode: Yang watches the table and calls out missed bell windows.
- Bilingual UI: Chinese and English copy switch without reload.

Independent browser project; not affiliated with any commercial card-game publisher.

---

## Quick Start

```bash
node --version       # v24.x
pnpm install
pnpm run dev         # Vite dev server on :5173
pnpm run dev:server  # socket.io server on :3001, in a second terminal
```

Open http://localhost:5173. Single-player works with only `pnpm run dev`; multiplayer needs the socket.io server.

Quality checks:

```bash
pnpm run test
pnpm run typecheck
pnpm run build
```

## How The Game Works

Cards are flipped one at a time, clockwise around the table. Each player's pile is face-up, but **only the top card counts**. Older cards underneath are invisible to the rule engine, matching the physical table rule.

Ring the bell when any single fruit totals exactly five across the visible top cards. Correct rings collect the table. Wrong rings forfeit cards. Missed bell windows apply a penalty and, in Boss Mode, trigger Yang's taunt.

| Event | Points |
|---|---:|
| Correct ring base | +120 |
| Collected cards | +6 per card |
| Speed bonus | up to +~50 |
| Consecutive streak | +10 per hit in current streak |
| Wrong ring | -50 |
| Penalty cards paid | -4 per card |
| Missed bell window | -30 |

| Mode | Flip speed | Speed-bonus window |
|---|---:|---|
| Easy | ~1.85 s | generous |
| Normal | ~1.4 s | standard |
| Boss | ~900 ms | tight |

## Player Features

### Single-Player Practice

- 3-6 player table layouts with clockwise flipping.
- Top-card-only bell validation.
- Configurable difficulty and round length.
- Speed bonus, streak scoring, wrong-ring penalty, and missed-window penalty.
- Animated end-of-round score breakdown.

### Multiplayer Rooms

- Create a room and share a 4-character match code.
- Up to 6 players with ready-up lobby and host controls.
- Server-authoritative game loop, so clients emit intent only.
- First valid bell press wins; simultaneous late presses receive penalties.
- Ranked per-player scoreboard at match end.

### Training Progress

- Last 5 rounds on the home screen.
- Rolling 100-round history in `localStorage` via `halligalli_history`.
- 14-day trend charts for accuracy and reaction time.
- Daily goal tracker with cross-day reset.
- 5 achievements with unlock timestamps and toast notifications.

### Accessibility And Polish

- 3D CSS card flips, bell particle burst, screen transitions, and 3-2-1 countdown.
- Sound effects with iOS audio unlock on game-entry actions.
- `prefers-reduced-motion` coverage for key animations.
- Screen-reader support through `aria-live`, bell labels, lobby dialog semantics, and screen-change focus management.
- WCAG 2.5.5 touch targets on mobile.

## Technical Shape

- React 19 + Vite 8 + TypeScript + plain CSS.
- Node.js 24 + socket.io 4 for real-time rooms.
- Vitest coverage across game rules, persistence, lifecycle, health, socket config, and stats.
- Shared gameplay modules under `src/game/` for browser and server runtime use.
- Server-authoritative multiplayer in `server/GameEngine.ts`.
- Browser-local progress in `localStorage`; no account system or database.

```text
src/
├── App.tsx              # UI shell and single-player game loop
├── audio/
│   └── useAudioEngine.ts
├── game/                # shared game logic for browser + server
│   ├── constants.ts
│   ├── lifecycle.ts
│   ├── persistence.ts
│   ├── rules.ts
│   ├── stats.ts
│   └── types.ts
└── multiplayer/
    ├── protocol.ts
    ├── socket.ts
    └── useMultiplayerSocket.ts

server/
├── GameEngine.ts        # multiplayer authority
├── Room.ts              # lobby and player model
├── health.ts
└── index.ts             # HTTP server + socket.io router

deploy/azure/            # Azure Production Terraform reference
scripts/simulate-bell.ts # card-distribution tuning utility
public/yang-boss.png     # Boss portrait
```

## Local Container Check

The default Dockerfile target is the Azure Container Apps backend image. It contains the compiled Node.js server plus shared gameplay modules and exposes `/readyz`, `/health`, and `/socket.io`; it does not include Vite frontend assets because Azure Production publishes those assets separately to Static Web Apps.

```bash
docker build -t halligalli-arena:local .
docker run --rm -p 3001:3001 halligalli-arena:local
curl --fail http://localhost:3001/readyz
```

For a local all-in-one container that serves the built frontend and socket.io from the same Node process:

```bash
docker build --target standalone -t halligalli-arena:standalone .
docker run --rm -p 3001:3001 halligalli-arena:standalone
```

## Production Build

```bash
pnpm install
pnpm run build
pnpm start
```

Open http://localhost:3001.

## Deployment And Operations

Azure Production is the visible manual stage for the active Azure Production target without implying production cutover. The public Terraform reference models an Azure Static Web Apps frontend and Azure Container Apps backend with example values; real account-specific tfvars, backend config, state, Azure credentials, deployment tokens, and domain bindings are intentionally excluded from Git.

The default Dockerfile output is the backend release image consumed by Azure Container Apps. Frontend assets are built with Vite and published by the Azure Production frontend deployment workflow to Static Web Apps, so the backend GHCR Release Image remains a Node.js/socket.io runtime image rather than an all-in-one web host.

- Release branch: `master`
- Versioning: Release Please creates human-merged release PRs and `vX.Y.Z` tags
- Release image: release tags build, scan, and publish immutable GHCR backend release images
- Azure infrastructure: `.github/workflows/azure-production-infra.yml`
- Azure deployment: `.github/workflows/azure-production.yml`
- Health check: `/health`
- Readiness check: `/readyz`

Operations docs:

- [CI/CD](docs/operations/ci-cd.md)
- [Azure Production](docs/operations/azure-production.md)
- [Rollback](docs/operations/rollback.md)

## License

All rights reserved.
