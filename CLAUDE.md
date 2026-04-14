## Project

**Halligalli Web Practice** — browser-based Halligalli trainer with single-player and real-time multiplayer. Tabletop-inspired card flow, configurable difficulty, Boss mode, bilingual UI, local score persistence, match-code rooms. Deployed as a single Node.js service on DigitalOcean App Platform serving both the Vite-built frontend and a socket.io game server.

**Core Value:** Open the site → meaningful practice immediately → fast feedback makes the next round better. Multiplayer is opt-in, same-origin, zero-config for the player.

### Constraints
- **Stack**: React 19 + Vite 7 + plain CSS + Node.js + socket.io — no frontend framework swaps
- **Architecture**: SPA + same-origin WebSocket server; local progress stays in localStorage
- **Platform**: Desktop and mobile browsers — both must feel intentional
- **Content**: Bilingual (zh/en) — new flows must not regress either language
- **Codebase**: Game logic extracted to `src/game/` and shared with `server/` via relative imports; `App.jsx` is still large — new features need incremental decomposition
- **Shared modules**: `src/game/*.js` runs in both browser (Vite) and Node (native ESM). All intra-module imports MUST use explicit `.js` extensions — Node ESM rejects extensionless specifiers.

## Technology Stack

- **Languages**: JavaScript (ES modules), CSS, HTML
- **Runtime**: Browser + Node.js (`^20.19.0 || >=22.12.0`) — Node serves static + WebSocket in production
- **Frameworks**: React 19, Vite 7, `@vitejs/plugin-react` 5, socket.io 4 (server) + socket.io-client 4 (browser); `vitest` for unit tests
- **Browser APIs used**: `localStorage`, `addEventListener`, `setTimeout`, `setInterval`, `AudioContext`/`webkitAudioContext`
- **Config**: No `.env`. `vite.config.js` proxies `/socket.io` → `localhost:3001` for dev. Runtime data in `localStorage` under `halligalli_settings`, `halligalli_best`, `halligalli_recent`, `halligalli_history` (rolling 100-round log).
- **Deploy**: DigitalOcean App Platform (ams region). `.do/app.yaml` describes the single web service. Production command: `npm install --include=dev && npm run build && npm start`. Server listens on `PORT` (3001 locally, injected in prod) and serves `dist/` + socket.io from the same origin.

## Conventions

### Naming
- `PascalCase` for React components (`FruitCardFace`, `TableSeat`, `App`) and their files (`App.jsx`)
- `camelCase` for state, locals, helpers (`bestSummary`, `handleBell`, `loadSettings`)
- `Ref` suffix for React refs (`revealIntervalRef`, `bellStateRef`, `gameStateRef`)
- `INITIAL_*` for reusable state shape constants (`INITIAL_SUMMARY`, `INITIAL_BREAKDOWN`)
- `UPPER_CASE` for static config tables (`FRUITS`, `MODES`, `COPY`, `PIP_LAYOUTS`, `COUNT_DISTRIBUTION`)
- Verb-first for side-effect functions (`applyBellAvailability`, `playFeedbackSound`, `triggerBossTaunt`)
- Boolean names read as conditions (`soundEnabled`, `bossDisrupting`, `isActive`, `isMultiplayer`)
- CSS classes: kebab-case; variants via additive classes (`.chip.active`, `.feedback.success`, `.glow-button`)
- Socket event names: `namespace:action` (`room:create`, `game:flip`, `game:bell-result`)

### Code Style
- No formatter or linter config — match existing style in `App.jsx`/`main.jsx`
- JSX: multiline props and nested ternaries preferred over compressed inline
- No comments unless logic is genuinely non-obvious from naming
- No JSDoc/TSDoc
- No TypeScript — plain JS objects throughout
- Relative imports only with explicit `.js` extension on shared modules (`./game/rules.js`) — Node ESM requires it; Vite tolerates either

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
- Every new `localStorage` key MUST get a `normalize*` function in `persistence.js` + a test in `src/__tests__/persistence.test.js`
- Audio goes through `useAudioEngine` — do not instantiate `AudioContext` directly in new code
- Multiplayer socket events: add handlers inside `useMultiplayerSocket`, not directly in `App.jsx`. Pass new state setters via the `actions` prop
- ARIA: feedback/penalty/boss-taunt divs must keep `aria-live`; bell button must keep `aria-label`+`aria-pressed`; lobby card keeps `role="dialog"`; screen sections keep `tabIndex={-1}` for focus management
- Touch targets: all interactive elements must stay ≥ 44px min-height at the 520px breakpoint (enforced in `.primary-button`, `.ghost-button`, `.chip`)
- iOS audio: call `ensureAudioContext()` at every entry point that leads to gameplay (startGame, createRoom, joinRoom)

## Architecture

### Structure
```
src/
├── main.jsx            — mounts App, imports styles
├── App.jsx             — all state, game loop, 4-screen render (~1520 lines, still shrinking)
├── styles.css          — all styles including 3D animations (~1890 lines)
├── audio/
│   └── useAudioEngine.js   — encapsulates AudioContext + tone scheduling; returns {playFeedback, ensureUnlocked}
├── game/
│   ├── constants.js    — FRUIT_KEYS, DEFAULT_SETTINGS, INITIAL_*, COUNT_DISTRIBUTION, storage keys, HISTORY_KEY, MAX_HISTORY, VALID_MODES
│   ├── persistence.js  — loadJson/saveJson, normalize/load settings & summaries, loadHistory/appendHistoryEntry/normalizeHistoryEntry
│   ├── rules.js        — deck creation, card flipping, bell evaluation, scoring math (shared with server)
│   ├── lifecycle.js    — clearGameLoopHandles
│   └── __tests__/      — vitest unit tests for rules, lifecycle
├── multiplayer/
│   ├── socket.js               — singleton socket.io-client wrapper (getSocket/connectSocket/disconnectSocket)
│   └── useMultiplayerSocket.js — subscribes to all room/game socket events; hoisted out of App.jsx
└── __tests__/
    └── persistence.test.js     — settings/summary/history normalization and rolling-log persistence

server/
├── index.js            — HTTP server (serves dist/ + SPA fallback + /health) + socket.io event router
├── Room.js             — Room/Player classes, match-code generation, host transfer, stale cleanup
├── GameEngine.js       — server-authoritative game loop, per-player scoring, bell race resolution
└── package.json        — legacy separate manifest (deps now hoisted to root; kept for standalone server dev)

public/yang-boss.png    — Boss portrait
.do/app.yaml            — DigitalOcean App Platform spec (ams region, node-js, port 3001)
scripts/simulate-bell.mjs — Monte Carlo utility for tuning COUNT_DISTRIBUTION (not shipped)
```

### State Machine
Screen-driven: `home → play → result` for single-player; `home → lobby → play → result` for multiplayer. All routing via `screen` useState — no router.

### Key State in App
- Navigation: `screen`
- Settings/history: `settings`, `bestSummary`, `recentSummary`, `history` (rolling round log, newest-first, capped at `MAX_HISTORY`)
- Simulation: `players`, `currentTurn`, `actingPlayer`, `secondsLeft`
- Scoring: `score`, `correctHits`, `wrongHits`, `missedHits`, `reactionTimes`, `streak`, `scoreBreakdown`
- Feedback: `feedback`, `activeBellFruit`, `penaltyNotice`, `bossTaunt`, `bossDisrupting`, `tauntEchoes`
- Animation: `justFlippedSeat`, `bellParticles`, `bellPressed`, `cardCollecting`, `countdown`
- Multiplayer: `isMultiplayer`, `roomCode`, `joinCode`, `roomPlayers`, `myPlayerId`, `mySeatIndex`, `lobbyError`, `multiResults`, `seatMap`
- Refs: `gameStateRef` (stale-closure guard), `gameRunningRef` (gate), `bellStateRef` (bell timing), timer refs (`revealIntervalRef`, `flipTimeoutRef`, `particleTimeoutRef`, `bellPressTimeoutRef`, `collectTimeoutRef`, `countdownTimerRef`)

### Game Loop
**Single-player**: `revealIntervalRef` fires every `mode.revealMs` (900–1850ms) → `advanceTurn()` → flips card clockwise → `applyBellAvailability()` checks if any fruit totals exactly 5 across top face-up cards → sets `bellStateRef` and `activeBellFruit`.

**Multiplayer**: server's `GameEngine` runs the interval, emits `game:flip` / `game:bell-result` / `game:tick` / `game:end` to all clients in the room. Clients render but do not drive. Bell presses are races — first valid press wins, others get the wrong-ring penalty. Missed bell windows penalize all players.

### Scoring
- Correct ring: 120 base + collected cards×6 + speed bonus + streak×10
- Wrong ring: −50 − penalty cards×4
- Missed bell: −30 (deducted at next `advanceTurn` or `finishGame`)
- Multiplayer final: ranked scoreboard by score, breakdown shown per player

### Card Distribution
`COUNT_DISTRIBUTION` in `src/game/constants.js` was tuned via `scripts/simulate-bell.mjs` Monte Carlo to target ~4–7 flips between bell windows across 3–6 player counts. Re-run the simulator before tweaking.

### Child Components
`FruitCardFace` and `TableSeat` are presentational props-only; no state. `TableSeat` accepts a `justFlipped` prop that drives the 3D flip animation via CSS classes on nested `.card-3d-container → .card-3d-inner → .card-3d-front/back` elements.

### Animations
All animations are CSS keyframes — no animation libraries. Key effects: 3D card flips (`rotateY` + `backface-visibility`), bell particles (`cos()`/`sin()` with CSS custom properties), screen transitions (`.screen-enter`), homepage staggered fade-rise, card collection shrink, bell press pulse, glow-sweep buttons, countdown pop. All gated by `prefers-reduced-motion`.

### Multiplayer Protocol
Client → server: `room:create`, `room:join`, `room:ready`, `room:start`, `game:bell`, `room:leave`
Server → client: `room:created`, `room:joined`, `room:player-update`, `room:error`, `room:dissolved`, `game:start`, `game:your-seat`, `game:flip`, `game:missed`, `game:bell-result`, `game:tick`, `game:end`

Host has exclusive `room:start` rights. Disconnects during lobby remove the player; disconnects mid-game mark them offline but keep the game running until all players disconnect.

## Deployment

- **Target**: DigitalOcean App Platform, Amsterdam (`ams`), `apps-s-1vcpu-0.5gb` instance
- **URL**: https://halligalli-8xko3.ondigitalocean.app/
- **App ID**: `a28fcbb5-7581-41f7-8bd6-6c9d0ded0994`
- **Trigger**: `git push origin master` (spec has `deploy_on_push: true`)
- **Manual redeploy**: `doctl apps create-deployment <app-id>`
- **Spec updates**: `doctl apps update <app-id> --spec .do/app.yaml`
- **Logs**: `doctl apps logs <app-id> --deployment <deployment-id> --type build|run`
- **Gotcha**: `build_command` must include `--include=dev` because Vite lives in devDependencies and App Platform's Node buildpack skips dev deps by default.
