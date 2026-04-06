# Architecture

**Analysis Date:** 2026-04-06

## Pattern Overview

**Overall:** Single-page React application with a monolithic stateful feature module.

**Key Characteristics:**
- `src/main.jsx` is a thin bootstrap that mounts a single exported root component from `src/App.jsx`.
- `src/App.jsx` combines domain model helpers, persistence helpers, timer orchestration, input handling, and all three screen renders in one file.
- UI state is screen-driven through `screen === "home" | "play" | "result"` branches in `src/App.jsx`, with no router and no separate state library.

## Layers

**Bootstrap Layer:**
- Purpose: Start the browser app and attach the React tree to the DOM.
- Location: `index.html`, `src/main.jsx`
- Contains: The root mount node, Vite entry script, `ReactDOM.createRoot`, and global stylesheet import.
- Depends on: `react`, `react-dom`, `src/App.jsx`, `src/styles.css`
- Used by: The browser runtime through the `<script type="module" src="/src/main.jsx">` tag in `index.html`

**Application / Game Layer:**
- Purpose: Own the Halligalli simulation, scoring, persistence, timers, and screen transitions.
- Location: `src/App.jsx`
- Contains: Static configuration (`FRUITS`, `MODES`, `COPY`), helper functions (`createDeck`, `createPlayers`, `visibleTotals`, `collectFaceUpCards`), local component definitions (`FruitCardFace`, `TableSeat`), and the `App` component.
- Depends on: React hooks, `window.localStorage`, `window.setInterval`, `window.setTimeout`, keyboard events, and Web Audio APIs.
- Used by: `src/main.jsx`

**Presentation Layer:**
- Purpose: Style the landing screen, game table, bell state, boss mode, and result screen.
- Location: `src/styles.css`
- Contains: Global typography and background styles plus component-level class rules such as `.app-shell`, `.table-felt`, `.center-bell`, `.boss-card`, and `.score-row`.
- Depends on: Class names emitted from `src/App.jsx`
- Used by: `src/main.jsx` via `import "./styles.css"`

**Static Asset Layer:**
- Purpose: Serve non-code assets referenced directly by the UI.
- Location: `public/yang-boss.png`
- Contains: Boss portrait image used on the home and play screens.
- Depends on: Vite public asset serving
- Used by: `<img src="/yang-boss.png" ... />` in `src/App.jsx`

**Documentation Layer:**
- Purpose: Capture product intent outside the runtime code.
- Location: `README.md`, `docs/prd-web-halligalli.md`, `AGENTS.md`
- Contains: Setup guidance, product requirements, and repo instructions.
- Depends on: None at runtime
- Used by: Developers only

## Data Flow

**Application Startup:**

1. `index.html` loads `/src/main.jsx` into the `#root` element.
2. `src/main.jsx` imports `src/App.jsx` and `src/styles.css`, then renders `<App />` inside `React.StrictMode`.
3. `App` initializes persistent state from `window.localStorage` through `loadJson()` and `loadSettings()` in `src/App.jsx`.
4. The first render shows the `"home"` branch, which exposes settings controls and the start action.

**Round Lifecycle:**

1. `startGame()` in `src/App.jsx` resets round state, creates fresh players with `createPlayers(settings.playerCount)`, and moves the UI to `screen === "play"`.
2. `startGame()` starts two loops: `revealIntervalRef` advances the simulated table with `advanceTurn()`, and `countdownIntervalRef` decrements `secondsLeft`.
3. `advanceTurn()` flips the current player's card via `flipCardForPlayer()`, updates `players`, advances `currentTurn`, and recomputes bell availability with `applyBellAvailability()`.
4. `handleBell()` reads the latest snapshot from `gameStateRef.current` and either rewards a correct bell using `collectFaceUpCards()` or applies a penalty using `takePenaltyCards()`.
5. `finishGame()` computes summary metrics from the latest snapshot, persists recent and best results to `window.localStorage`, and moves the UI to `screen === "result"`.

**Persistence Flow:**

1. `settings`, `bestSummary`, and `recentSummary` are initialized from `SETTINGS_KEY`, `BEST_KEY`, and `RECENT_KEY` in `src/App.jsx`.
2. A `useEffect` writes settings changes back through `saveJson(SETTINGS_KEY, settings)`.
3. `finishGame()` writes round summaries to `RECENT_KEY` and conditionally updates `BEST_KEY`.

**Input Flow:**

1. Home screen buttons call `updateSetting()` and `startGame()` in `src/App.jsx`.
2. Play screen bell clicks call `handleBell()`.
3. A `useEffect` in `src/App.jsx` registers a `keydown` listener so `Space` triggers `handleBell()` while `screen === "play"`.

## State Management

**Primary Ownership:**
- `App` in `src/App.jsx` owns all mutable application state through `useState`.
- There is no context provider, reducer, or external store; child components `FruitCardFace` and `TableSeat` are presentational and receive all data via props.

**Runtime State Groups in `src/App.jsx`:**
- Screen/navigation state: `screen`
- Settings/persistence state: `settings`, `bestSummary`, `recentSummary`
- Core simulation state: `players`, `currentTurn`, `actingPlayer`, `secondsLeft`
- Scoring state: `score`, `correctHits`, `wrongHits`, `missedHits`, `reactionTimes`, `streak`, `scoreBreakdown`
- Feedback state: `feedback`, `activeBellFruit`, `penaltyNotice`, `bossTaunt`, `bossDisrupting`, `tauntEchoes`

**Imperative Coordination State:**
- `gameStateRef` stores a current snapshot so interval callbacks avoid stale closures.
- `gameRunningRef` gates timer-driven work after a round ends.
- `bellStateRef` stores whether a valid bell window exists and when it started.
- Timeout and interval refs (`revealIntervalRef`, `countdownIntervalRef`, `feedbackTimeoutRef`, `penaltyTimeoutRef`, `bossTauntTimeoutRef`) centralize cleanup in `stopGameLoops()`.

## Key Abstractions

**Player Model:**
- Purpose: Represent one simulated seat at the table.
- Examples: `createPlayers()`, `flipCardForPlayer()`, `recycleDrawPile()` in `src/App.jsx`
- Pattern: Plain object records with `drawPile`, `wonPile`, and `faceUpPile` arrays.

**Card / Deck Generation:**
- Purpose: Produce the shuffled practice deck and assign it across players.
- Examples: `createCard()`, `createDeck()`, `shuffle()` in `src/App.jsx`
- Pattern: Deterministic distribution rules plus a randomized order.

**Seat Layout Mapping:**
- Purpose: Translate player count into visual table positions and the user seat.
- Examples: `getSeatLayouts()` in `src/App.jsx`
- Pattern: Static coordinate tables keyed by `3`, `4`, `5`, and `6` players.

**Bell Resolution:**
- Purpose: Detect valid bell windows and resolve success, miss, or penalty outcomes.
- Examples: `visibleTotals()`, `applyBellAvailability()`, `handleBell()`, `advanceTurn()` in `src/App.jsx`
- Pattern: Derived totals from face-up cards plus imperative refs for timing-sensitive state.

## Entry Points

**Browser Entry Point:**
- Location: `index.html`
- Triggers: Browser page load
- Responsibilities: Define the root DOM node and point Vite to `src/main.jsx`

**React Entry Point:**
- Location: `src/main.jsx`
- Triggers: Imported by `index.html`
- Responsibilities: Import global CSS, create the React root, and render `App`

**Application Entry Point:**
- Location: `src/App.jsx`
- Triggers: Rendered by `src/main.jsx`
- Responsibilities: Initialize state, expose the home screen, start and stop rounds, and render all app screens

## Error Handling

**Strategy:** Defensive fallback handling rather than surfaced error boundaries.

**Patterns:**
- `loadJson()` in `src/App.jsx` wraps `JSON.parse` in `try/catch` and falls back to defaults if local storage data is invalid.
- Browser-only APIs are guarded with checks such as `typeof window === "undefined"` in `loadJson()`, `saveJson()`, and `ensureAudioContext()`.
- Timer and audio cleanup is centralized in `stopGameLoops()` and the unmount cleanup effect in `src/App.jsx`.

## Cross-Cutting Concerns

**Logging:** Not used in the runtime code.

**Validation:** Inline guards enforce safe behavior, such as early returns when the game is not running, when no bell window exists, or when audio is disabled.

**Authentication:** Not applicable. The app is fully local and does not perform user login.

**Persistence:** `window.localStorage` is the only storage mechanism, used for settings and score summaries in `src/App.jsx`.

**Routing:** Not applicable. Screen changes are handled by the local `screen` state in `src/App.jsx`.

---

*Architecture analysis: 2026-04-06*
