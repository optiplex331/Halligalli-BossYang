<p align="center">
  <img src="public/icon.svg" width="96" height="96" alt="Halligalli Arena icon" />
</p>

# Halligalli Arena

Real-time multiplayer Halligalli for midnight card-table races.

Create a room, ready up with friends, flip around a server-authoritative table, and race to spot the exact-five fruit total first. Solo practice is included, but the product story is a fast multiplayer Halligalli arena.

[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646cff?style=flat-square)](https://vite.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?style=flat-square)](https://www.typescriptlang.org/)
[![socket.io](https://img.shields.io/badge/socket.io-4-111?style=flat-square)](https://socket.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-f0c44a?style=flat-square)](LICENSE)

**Live demo**: `https://play.halligalli.games` on Azure Kubernetes Production.

![Halligalli Arena showcase](docs/assets/readme-showcase.svg)

## What It Does

- **Real-time rooms**: create a 4-character room code, ready up, and race friends on one shared table.
- **Halligalli race loop**: flip cards, read the visible fruit count, and compete for the exact-five hit.
- **Table-true rules**: clockwise flips, top-card-only counting, exact-five bell windows.
- **Server authority**: multiplayer clients emit intent; the server owns flips, scoring, and match finish.
- **Solo practice**: train reaction speed, accuracy, streaks, and missed-window discipline.
- **Training memory**: local history, trend charts, daily goals, and achievements without accounts.
- **Midnight table polish**: 3D card flips, bell particles, Boss Yang pressure, sound, and reduced-motion fallbacks.

Independent browser project; not affiliated with any commercial card-game publisher.

## Quick Start

```bash
node --version       # v24.x
pnpm install
pnpm run dev         # Vite dev server on :5173
pnpm run dev:server  # socket.io server on :3001, in a second terminal
```

Open http://localhost:5173.

Single-player works with only `pnpm run dev`. Multiplayer needs `pnpm run dev:server`.

## Commands

```bash
pnpm run test
pnpm run typecheck
pnpm run build
pnpm start
```

Container checks:

```bash
docker build -t halligalli-arena:local .
docker run --rm -p 3001:3001 halligalli-arena:local
curl --fail http://localhost:3001/readyz
```

For a local all-in-one image that serves the built frontend and socket.io from one Node process:

```bash
docker build --target standalone -t halligalli-arena:standalone .
docker run --rm -p 3001:3001 halligalli-arena:standalone
```

## Rules Model

Cards flip clockwise around the table. Each player has a face-up pile, but only the top card counts. Older cards underneath are invisible to the rule engine.

Ring when one fruit totals exactly five across visible top cards.

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

## Project Shape

```text
src/
├── App.tsx                 # UI shell and single-player game loop
├── audio/useAudioEngine.ts # Web Audio hook
├── game/                   # shared browser + server game logic
└── multiplayer/            # socket protocol and client projection

server/
├── GameEngine.ts           # multiplayer authority
├── Room.ts                 # lobby and player model
├── health.ts
└── index.ts                # HTTP server + socket.io router

docs/operations/            # release, Azure, and rollback docs
```

## Design Boundaries

- React 19 + Vite 8 + TypeScript + plain CSS.
- Node.js 24 + socket.io 4.
- Browser progress stays in `localStorage`.
- No account system, database, router, state library, or CSS framework.
- Stable visible copy stays bilingual in Chinese and English.
- New animations must respect `prefers-reduced-motion`.

## Privacy And Safety

Halligalli Arena stores training progress locally in the browser. It does not require accounts, payment data, or a server-side player profile.

Multiplayer rooms are transient in-memory socket.io rooms. The server owns scoring and match results so clients cannot submit authoritative wins.

See [SECURITY.md](SECURITY.md) for reporting and safety boundaries.

## Deployment

Azure Kubernetes Production is the active production story after the AKS cutover decision. It uses the standalone Halligalli runtime, infrastructure-owned Helm Chart and Azure Kubernetes Desired State, Argo CD, and same-origin traffic at `play.halligalli.games`.

Container Apps-backed Azure Production is historical after cutover; its Terraform-managed resources were destroyed and it is not an active fallback. Production Kubernetes chart templates, real Azure Kubernetes Desired State, and cloud operations live in the infrastructure repo.

- Release branch: `master`
- Versioning: Release Please creates human-merged release PRs and `vX.Y.Z` tags
- Release image: release tags build, scan, and publish immutable GHCR standalone images
- Azure infrastructure: AKS and GitOps desired state are operated from the infrastructure repo
- Historical Azure deployment: `.github/workflows/azure-production.yml`
- Kubernetes production render surface: infrastructure-owned chart, values, and Argo CD Application
- Health check: `/health`
- Readiness check: `/readyz`

The first Container Apps-backed Azure Production activation has been verified historically. Current production language should use Azure Kubernetes Production; old Container Apps resources should be inspected or destroyed only through deliberate local infrastructure operations.

Operations docs:

- [CI/CD](docs/operations/ci-cd.md)
- [Azure Production](docs/operations/azure-production.md)
- [Kubernetes](docs/operations/kubernetes.md)
- [Standalone Release Image Migration Plan](docs/operations/standalone-release-image-migration.md)
- [Rollback](docs/operations/rollback.md)

## Contributing

Small, focused pull requests are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md), then run:

```bash
pnpm run test
pnpm run typecheck
pnpm run build
```

## License

MIT. See [LICENSE](LICENSE).
