## Project

**Halligalli Web Practice** — browser-based single-player Halligalli trainer. Tabletop-inspired card flow, configurable difficulty, Boss mode, bilingual UI, local score persistence. Next goal: clearer onboarding, structured training, better feedback on accuracy and progress.

**Core Value:** Open the site → meaningful practice immediately → fast feedback makes the next round better.

### Constraints
- **Stack**: React 19 + Vite 7 + plain CSS — no changes to frontend stack
- **Architecture**: SPA, client-only, browser localStorage — no backend/auth/cloud
- **Scope**: Single-player training first; social/competitive features deferred
- **Platform**: Desktop and mobile browsers — both must feel intentional
- **Content**: Bilingual (zh/en) — new flows must not regress either language
- **Codebase**: Game logic extracted to `src/game/`; `App.jsx` still large — new features need incremental decomposition

## Technology Stack

- **Languages**: JavaScript (ES modules), CSS, HTML
- **Runtime**: Browser-only; Node.js for Vite toolchain (`^20.19.0 || >=22.12.0`)
- **Frameworks**: React 19, Vite 7, `@vitejs/plugin-react` 5 — no test framework configured
- **Key deps**: `react`, `react-dom`, `vite`, `@vitejs/plugin-react` (only explicit plugin)
- **Browser APIs used**: `localStorage`, `addEventListener`, `setTimeout`, `setInterval`, `AudioContext`/`webkitAudioContext`
- **Config**: No `.env`, no aliases, no env injection. `vite.config.js` is default shape. Runtime settings in `localStorage` under `halligalli_settings`, `halligalli_best`, `halligalli_recent`.
- **Deploy**: Static hosting only — no server code. Output to `dist/` (gitignored).

## Conventions

### Naming
- `PascalCase` for React components (`FruitCardFace`, `TableSeat`, `App`) and their files (`App.jsx`)
- `camelCase` for state, locals, helpers (`bestSummary`, `handleBell`, `loadSettings`)
- `Ref` suffix for React refs (`revealIntervalRef`, `bellStateRef`, `gameStateRef`)
- `INITIAL_*` for reusable state shape constants (`INITIAL_SUMMARY`, `INITIAL_BREAKDOWN`)
- `UPPER_CASE` for static config tables (`FRUITS`, `MODES`, `COPY`, `PIP_LAYOUTS`)
- Verb-first for side-effect functions (`applyBellAvailability`, `playFeedbackSound`, `triggerBossTaunt`)
- Boolean names read as conditions (`soundEnabled`, `bossDisrupting`, `isActive`)
- CSS classes: kebab-case; variants via additive classes (`.chip.active`, `.feedback.success`)

### Code Style
- No formatter or linter config — match existing style in `App.jsx`/`main.jsx`
- JSX: multiline props and nested ternaries preferred over compressed inline
- No comments unless logic is genuinely non-obvious from naming
- No JSDoc/TSDoc
- No TypeScript — plain JS objects throughout
- Relative imports only (`./App`, `./game/rules`) — no path aliases

### Patterns
- Guard all browser APIs: `typeof window === "undefined"` before `localStorage`/Web Audio
- Functional state updates when derived from previous state: `setState((v) => v + 1)`
- Timer refs (`*Ref`) cleaned up centrally in `stopGameLoops()` → `clearGameLoopHandles()`
- New player counts require updates to both UI chips and `getSeatLayouts()` together
- `applyBellAvailability()` is the single authoritative bell-rule validation point
- Score clamped with `Math.max(0, ...)` wherever penalties apply
- No `console.*` logging — user feedback goes to UI state (`feedback`, `penaltyNotice`, `bossTaunt`)
- Default export only for main component; helpers stay file-local or in `src/game/`

## Architecture

### Structure
```
src/
├── main.jsx          — mounts App, imports styles
├── App.jsx           — all state, game loop, audio, 3-screen render (~1100 lines)
├── styles.css        — all styles (~910 lines)
└── game/
    ├── constants.js  — FRUIT_KEYS, DEFAULT_SETTINGS, INITIAL_*, storage keys
    ├── persistence.js — loadJson/saveJson, normalize/load settings & summaries
    ├── rules.js      — deck creation, card flipping, bell evaluation, scoring math
    ├── lifecycle.js  — clearGameLoopHandles
    └── __tests__/    — unit tests for rules, persistence, lifecycle
public/yang-boss.png  — Boss portrait
```

### State Machine
Screen-driven: `home → play → result` via `screen` useState. No router.

### Key State in App
- Navigation: `screen`
- Settings/history: `settings`, `bestSummary`, `recentSummary`
- Simulation: `players`, `currentTurn`, `actingPlayer`, `secondsLeft`
- Scoring: `score`, `correctHits`, `wrongHits`, `missedHits`, `reactionTimes`, `streak`, `scoreBreakdown`
- Feedback: `feedback`, `activeBellFruit`, `penaltyNotice`, `bossTaunt`, `bossDisrupting`, `tauntEchoes`
- Refs: `gameStateRef` (stale-closure guard), `gameRunningRef` (gate), `bellStateRef` (bell timing), timer refs

### Game Loop
`revealIntervalRef` fires every `mode.revealMs` (900–1850ms) → `advanceTurn()` → flips card clockwise → `applyBellAvailability()` checks if any fruit totals exactly 5 across top face-up cards → sets `bellStateRef` and `activeBellFruit`.

### Scoring
- Correct ring: 120 base + collected cards×6 + speed bonus + streak×10
- Wrong ring: −50 − penalty cards×4
- Missed bell: −30 (deducted at next `advanceTurn` or `finishGame`)

### Child Components
`FruitCardFace` and `TableSeat` are presentational props-only; no state.
