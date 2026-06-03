## Project

**Halligalli Web Practice** — browser-based Halligalli trainer with single-player and real-time multiplayer. Tabletop-inspired card flow, configurable difficulty, Boss mode, bilingual UI, local score persistence, match-code rooms. Deployed as a single Node.js service on DigitalOcean App Platform serving both the Vite-built frontend and a socket.io game server.

**Core Value:** Open the site → meaningful practice immediately → fast feedback makes the next round better. Multiplayer is opt-in, same-origin, zero-config for the player.

### Constraints
- **Stack**: React 19 + Vite 8 + TypeScript + plain CSS + Node.js + socket.io — no frontend framework swaps
- **Architecture**: SPA + same-origin WebSocket server; local progress stays in localStorage
- **Platform**: Desktop and mobile browsers — both must feel intentional
- **Content**: Bilingual (zh/en) — new flows must not regress either language
- **Codebase**: Game logic extracted to `src/game/` and shared with `server/` via relative imports; `App.tsx` is still large — new features need incremental decomposition
- **Shared modules**: `src/game/*.ts` runs in both browser (Vite) and Node after compilation. Local runtime imports that compile to Node.js ESM MUST use emitted `.js` extensions.

## Commands

```bash
pnpm run dev          # Vite dev server (port 5173, proxies /socket.io → :3001)
pnpm run dev:server   # Game server only (port 3001) — run alongside dev
pnpm run test         # vitest run (all unit tests, no watch)
pnpm run typecheck    # TypeScript checks for browser + server projects
pnpm run build        # Production build → dist/
pnpm start            # Serve dist/ + socket.io (production)
```

## Git

- Use a task branch for non-trivial work; do not make feature or fix changes directly on `master`.
- Follow Angular commit messages: `<type>(<scope>): <summary>`, for example `fix(game): clamp penalty score`.
- Keep code and matching documentation changes in the same branch and commit set.
- Deployment is GitOps-controlled: Release Please opens Release PRs, `vX.Y.Z` tags publish GHCR Release Images, Production Promotion PRs update `deploy/production/app.yaml`, and `Reconcile DO Production` applies that manifest to DigitalOcean.

## Technology Stack

- **Languages**: TypeScript, CSS, HTML
- **Runtime**: Browser + Node.js 24 (`>=24.0.0 <25`) — Node serves static + WebSocket in production
- **Frameworks**: React 19, Vite 8, `@vitejs/plugin-react` 6, socket.io 4 (server) + socket.io-client 4 (browser); `vitest` for unit tests
- **Config**: No `.env`. `vite.config.ts` proxies `/socket.io` → `localhost:3001` for dev. Runtime data in `localStorage` under `halligalli_settings`, `halligalli_best`, `halligalli_recent`, `halligalli_history` (rolling 100-round log).

## Conventions

### Naming
- `Ref` suffix for React refs (`revealIntervalRef`, `bellStateRef`, `gameStateRef`)
- `INITIAL_*` for reusable state shape constants (`INITIAL_SUMMARY`, `INITIAL_BREAKDOWN`)
- `UPPER_CASE` for static config tables (`FRUITS`, `MODES`, `COPY`, `PIP_LAYOUTS`, `COUNT_DISTRIBUTION`)
- Verb-first for side-effect functions (`applyBellAvailability`, `playFeedbackSound`, `triggerBossTaunt`)
- CSS classes: kebab-case; variants via additive classes (`.chip.active`, `.feedback.success`, `.glow-button`)
- Socket event names: `namespace:action` (`room:create`, `game:flip`, `game:bell-result`)

### Code Style
- No formatter or linter config — match existing style in `App.tsx`/`main.tsx`
- JSX: multiline props and nested ternaries preferred over compressed inline
- No comments unless logic is genuinely non-obvious from naming
- No JSDoc/TSDoc
- TypeScript source uses structural types and small shared protocol/game types where they protect cross-runtime contracts
- Relative runtime imports that compile to Node.js ESM use explicit emitted `.js` extensions (`./game/rules.js`) — Node ESM requires it; Vite tolerates either

### Patterns
- Guard all browser APIs: `typeof window === "undefined"` before `localStorage`/Web Audio
- Functional state updates when derived from previous state: `setState((v) => v + 1)`
- Timer refs (`*Ref`) cleaned up centrally in `stopGameLoops()` → `clearGameLoopHandles()`; animation timers cleaned up alongside
- New player counts require updates to both UI chips and `getSeatLayouts()` together
- `applyBellAvailability()` is the single authoritative bell-rule validation point (single-player); server's `GameEngine.evaluateBell()` is the authority in multiplayer
- Score clamped with `Math.max(0, ...)` wherever penalties apply
- No `console.*` logging in client — user feedback goes to UI state (`feedback`, `penaltyNotice`, `bossTaunt`); server uses `console.log` sparingly for room lifecycle events
- Default export only for main component; helpers stay file-local or in `src/game/`
- Multiplayer uses server-authoritative state — client emits intent (`game:bell`), never mutates game state locally in multiplayer mode; single-player path is unchanged
- Reduced-motion: every new keyframe animation must have a `@media (prefers-reduced-motion: reduce)` override
- Every new `localStorage` key MUST get a `normalize*` function in `persistence.ts` + a test in `src/__tests__/persistence.test.ts`
- Audio goes through `useAudioEngine` — do not instantiate `AudioContext` directly in new code
- Multiplayer socket events: add handlers inside `useMultiplayerSocket`, not directly in `App.tsx`. Pass new state setters via the `actions` prop
- ARIA: feedback/penalty/boss-taunt divs must keep `aria-live`; bell button must keep `aria-label`+`aria-pressed`; lobby card keeps `role="dialog"`; screen sections keep `tabIndex={-1}` for focus management
- Touch targets: all interactive elements must stay ≥ 44px min-height at the 520px breakpoint (enforced in `.primary-button`, `.ghost-button`, `.chip`)
- iOS audio: call `ensureAudioContext()` at every entry point that leads to gameplay (startGame, createRoom, joinRoom)

## Architecture

### Structure
```
src/
├── main.tsx            — mounts App, imports styles
├── App.tsx             — all state, game loop, 4-screen render, still shrinking
├── styles.css          — all styles including 3D animations
├── audio/
│   └── useAudioEngine.ts   — encapsulates AudioContext + tone scheduling; returns {playFeedback, ensureUnlocked}
├── game/
│   ├── constants.ts    — FRUIT_KEYS, DEFAULT_SETTINGS, INITIAL_*, COUNT_DISTRIBUTION, storage keys, HISTORY_KEY, MAX_HISTORY, VALID_MODES
│   ├── persistence.ts  — loadJson/saveJson, normalize/load settings & summaries, loadHistory/appendHistoryEntry/normalizeHistoryEntry
│   ├── rules.ts        — deck creation, card flipping, bell evaluation, scoring math (shared with server)
│   ├── lifecycle.ts    — clearGameLoopHandles
│   ├── stats.ts        — pure stat functions for streaks, trends, and daily goals
│   ├── types.ts        — shared gameplay types
│   └── __tests__/      — vitest unit tests for stats (bell simulation)
├── multiplayer/
│   ├── protocol.ts             — shared multiplayer payload types
│   ├── socket.ts               — singleton socket.io-client wrapper (getSocket/connectSocket/disconnectSocket)
│   └── useMultiplayerSocket.ts — subscribes to all room/game socket events; hoisted out of App.tsx
└── __tests__/
    ├── persistence.test.ts     — settings/summary/history normalization and rolling-log persistence
    ├── rules.test.ts           — deck creation, bell evaluation, scoring math
    └── lifecycle.test.ts       — game loop handle cleanup

server/
├── index.ts            — HTTP server (serves dist/ + SPA fallback + /health) + socket.io event router
├── health.ts           — /health response shape and release identity projection
├── Room.ts             — Room/Player classes, match-code generation, host transfer, stale cleanup
├── GameEngine.ts       — server-authoritative game loop, per-player scoring, bell race resolution
└── package.json        — legacy separate manifest (deps now hoisted to root; kept for standalone server dev)

public/yang-boss.png    — Boss portrait
deploy/production/app.yaml — GitOps Production Manifest applied by Reconcile DO Production
.github/utils/          — dependency-free GitHub Actions utilities for release config and Production Manifest release identity handling
scripts/simulate-bell.ts — Monte Carlo utility for tuning COUNT_DISTRIBUTION (not shipped)
```

### State Machine
Screen-driven: `home → play → result` for single-player; `home → lobby → play → result` for multiplayer. All routing via `screen` useState — no router.

### Key Refs
`gameStateRef` (stale-closure guard for async callbacks), `gameRunningRef` (loop gate), `bellStateRef` (bell timing). All state names derivable from App.tsx.

### Game Loop
**Single-player**: `revealIntervalRef` fires every `mode.revealMs` (900–1850ms) → `advanceTurn()` → flips card clockwise → `applyBellAvailability()` checks if any fruit totals exactly 5 across top face-up cards → sets `bellStateRef` and `activeBellFruit`.

**Multiplayer**: server's `GameEngine` runs the interval, emits `game:flip` / `game:bell-result` / `game:tick` / `game:end` to all clients in the room. Clients render but do not drive. Bell presses are races — first valid press wins, others get the wrong-ring penalty. Missed bell windows penalize all players.

### Scoring
- Correct ring: 120 base + collected cards×6 + speed bonus + streak×10
- Wrong ring: −50 − penalty cards×4
- Missed bell: −30 (deducted at next `advanceTurn` or `finishGame`)
- Multiplayer final: ranked scoreboard by score, breakdown shown per player

### Card Distribution
`COUNT_DISTRIBUTION` in `src/game/constants.ts` was tuned via `scripts/simulate-bell.ts` Monte Carlo to target ~4–7 flips between bell windows across 3–6 player counts. Re-run the simulator before tweaking.

### Child Components
`FruitCardFace` and `TableSeat` are presentational props-only; no state. `TableSeat` accepts a `justFlipped` prop that drives the 3D flip animation via CSS classes on nested `.card-3d-container → .card-3d-inner → .card-3d-front/back` elements.

### Animations
All animations are CSS keyframes — no animation libraries. Key effects: 3D card flips (`rotateY` + `backface-visibility`), bell particles (`cos()`/`sin()` with CSS custom properties), screen transitions (`.screen-enter`), homepage staggered fade-rise, card collection shrink, bell press pulse, glow-sweep buttons, countdown pop. All gated by `prefers-reduced-motion`.

### Multiplayer Protocol
Client → server: `room:create`, `room:join`, `room:ready`, `room:start`, `game:bell`, `room:leave`
Server → client: `room:created`, `room:joined`, `room:player-update`, `room:error`, `room:dissolved`, `game:start`, `game:your-seat`, `game:flip`, `game:missed`, `game:bell-result`, `game:tick`, `game:end`

Host has exclusive `room:start` rights. Disconnects during lobby remove the player; disconnects mid-game mark them offline but keep the game running until all players disconnect.

## Deployment

- DO Production runs on DigitalOcean App Platform in `ams`.
- Production changes flow through Release Please, Release Tags, GHCR Release Images, Production Promotion PRs, and `deploy/production/app.yaml`.
- Manual redeploys use the `Reconcile DO Production` workflow.
- Production must use the GHCR Release Image digest from the Production Manifest; do not deploy `latest` or source rebuilds.
- Keep structured release parsing and Production Manifest release identity handling in dependency-free `.github/utils/*.py` scripts with Python `unittest` coverage.
- Operational details live in `docs/operations/`.
