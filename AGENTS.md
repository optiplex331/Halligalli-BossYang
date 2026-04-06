# Repository Guidelines

## Project Structure & Module Organization
This repository is a small Vite + React app for Halligalli practice. Keep active app code in `src/`:

- `src/App.jsx` contains the main game flow and UI state.
- `src/main.jsx` boots the React app.
- `src/styles.css` holds the shared presentation layer.
- `public/` stores static assets such as `public/yang-boss.png`.
- `docs/` holds product or design notes, currently `docs/prd-web-halligalli.md`.
- `dist/` is build output; treat it as generated and do not hand-edit it.

## Build, Test, and Development Commands
- `npm install` installs dependencies.
- `npm run dev` starts the local Vite dev server, typically at `http://localhost:5173`.
- `npm run build` creates a production bundle in `dist/`.
- `npm run preview` serves the built bundle locally for a final smoke check.

Run `npm run build` before opening a PR to catch production-only issues.

## Coding Style & Naming Conventions
Follow the existing style in `src/`: 2-space indentation, semicolons, and double quotes in JavaScript. Prefer functional React components and keep related constants near the top of the file. Use:

- `PascalCase` for React components
- `camelCase` for variables and functions
- `UPPER_SNAKE_CASE` for fixed configuration keys and constants
- kebab-case CSS class names such as `.boss-card` or `.primary-button`

There is no configured ESLint or Prettier setup yet, so match the current file formatting closely and keep edits consistent.

## Testing Guidelines
There is no automated test framework configured yet. For now, verify changes with:

1. `npm run dev` for interactive gameplay checks
2. `npm run build` for production validation
3. `npm run preview` for a quick post-build smoke test

When adding tests later, place them beside the source file or under a dedicated `src/__tests__/` folder and use names like `App.test.jsx`.

## Commit & Pull Request Guidelines
The current git history uses short imperative commit subjects, for example: `Add Halligalli boss practice MVP`. Follow that pattern.

PRs should include a clear summary, note any gameplay or UI changes, list manual verification steps, and attach screenshots or a short recording for visible interface updates.

## GSD Planning Artifacts
- Project context lives in `.planning/PROJECT.md`.
- Workflow settings live in `.planning/config.json`.
- Research artifacts live in `.planning/research/`.
- Scoped build requirements live in `.planning/REQUIREMENTS.md`.
- Phase structure and current sequencing live in `.planning/ROADMAP.md`.
- Session/project memory lives in `.planning/STATE.md`.

Use the planning artifacts as the source of truth for future GSD commands in this repo. After initialization, the next step is `/gsd-discuss-phase 1` or `/gsd-plan-phase 1`.

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Halligalli Web Practice**

Halligalli Web Practice is a browser-based Halligalli training app for players who want to learn the rules, sharpen recognition, and improve bell timing without needing a physical deck or multiple people in the room. The current app already delivers a local single-player practice experience with tabletop-inspired card flow, configurable difficulty, Boss mode pressure, bilingual copy, and local score persistence. The next project goal is to evolve that foundation toward the PRD's broader product shape: clearer onboarding, more structured training, and stronger feedback on accuracy, mistakes, and progress.

**Core Value:** A player should be able to open the site and get meaningful Halligalli practice immediately, with fast feedback that makes their next round better.

### Constraints

- **Tech stack**: React 19 + Vite 7 + plain CSS — preserve the existing frontend stack to keep momentum in the current codebase
- **Architecture**: Single-page client-only app with browser local storage — there is no backend, auth, or cloud persistence to lean on
- **Product scope**: Single-player training first — the PRD explicitly prioritizes practice quality before social or competitive features
- **Platform**: Desktop and mobile browsers — the next iteration must feel intentional on both form factors
- **Content**: Bilingual UI support already exists — new flows should not regress Chinese / English parity
- **Codebase shape**: Most logic lives in one large component today — feature work should account for current coupling and likely need incremental decomposition
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- JavaScript (ES modules) - The app code lives in `src/App.jsx` and `src/main.jsx`, with package metadata in `package.json`.
- CSS - Shared styling is implemented in `src/styles.css`.
- HTML - The Vite entry document is `index.html`.
- Markdown - Product and setup docs live in `README.md` and `docs/prd-web-halligalli.md`.
## Runtime
- Node.js - Required for the Vite toolchain declared in `package.json`.
- Browser runtime - The shipped app mounts into `#root` from `index.html` and runs entirely client-side from `src/main.jsx`.
- Browser Web APIs - `src/App.jsx` depends on `window.localStorage`, `window.addEventListener`, `window.setTimeout`, `window.setInterval`, and `window.AudioContext` / `window.webkitAudioContext`.
- npm - The repo uses npm scripts in `package.json`.
- Lockfile: present in `package-lock.json` (lockfileVersion `3`).
- `package.json` declares `react` `^19.1.1`, `react-dom` `^19.1.1`, `vite` `^7.1.3`, and `@vitejs/plugin-react` `^5.0.0`.
- `package-lock.json` resolves `react` to `19.2.4`, `react-dom` to `19.2.4`, `vite` to `7.3.1`, and `@vitejs/plugin-react` to `5.1.4`.
- `package-lock.json` shows Vite 7 and `@vitejs/plugin-react` 5 requiring Node `^20.19.0 || >=22.12.0`.
## Frameworks
- React 19 - UI rendering and state management in `src/App.jsx` and `src/main.jsx`.
- Vite 7 - Dev server, build pipeline, and preview server configured through `package.json`, `vite.config.js`, and `index.html`.
- Not detected - No `vitest`, `jest`, or test config files are present in the repository root.
- `@vitejs/plugin-react` 5 - Enables the React transform in `vite.config.js`.
- Rollup / esbuild via Vite - Bundling and transforms are pulled in transitively through `vite` in `package-lock.json`.
## Key Dependencies
- `react` - The entire app is a single React tree rooted in `src/main.jsx`.
- `react-dom` - `src/main.jsx` uses `ReactDOM.createRoot(...)` to mount the app.
- `vite` - Provides `npm run dev`, `npm run build`, and `npm run preview` from `package.json`.
- `@vitejs/plugin-react` - The only explicit Vite plugin; registered in `vite.config.js`.
- Static asset pipeline - The boss image is served from `public/yang-boss.png` and referenced as `/yang-boss.png` in `src/App.jsx`.
## Configuration
- No `.env` files were detected at repo root or one level below during analysis.
- No `import.meta.env` or `process.env` usage was found in `src/`, `index.html`, or `vite.config.js`.
- Runtime settings are stored in browser `localStorage` under `halligalli_settings`, `halligalli_best`, and `halligalli_recent` in `src/App.jsx`.
- `vite.config.js` uses the default `defineConfig({ plugins: [react()] })` shape with no custom aliases, env injection, server config, or build targets.
- `index.html` is the only HTML entry and loads `src/main.jsx` directly as a module.
- Generated output is written to `dist/`, which is gitignored in `.gitignore`.
## Platform Requirements
- Node.js version compatible with Vite 7 / plugin-react 5 (`^20.19.0 || >=22.12.0` per `package-lock.json`).
- npm to run `npm install`, `npm run dev`, `npm run build`, and `npm run preview` from `package.json`.
- A modern browser with ES module support; sound features additionally depend on Web Audio support used in `src/App.jsx`.
- Static hosting is sufficient. The app has no server code, no API proxy, and no backend runtime; the deployable surface is `index.html`, bundled assets under `dist/`, and static assets such as `yang-boss.png`.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Use `PascalCase` for the main React component file: `src/App.jsx`.
- Use lowercase entrypoint naming for bootstrapping files: `src/main.jsx`.
- Use lowercase kebab-style names for stylesheet files: `src/styles.css`.
- Keep static assets in `public/` with descriptive kebab-case names: `public/yang-boss.png`.
- Use `camelCase` for utilities and event/state helpers in `src/App.jsx`: `loadJson`, `loadSettings`, `saveJson`, `createDeck`, `getSeatLayouts`, `visibleTotals`, `startGame`, `handleBell`, `finishGame`, `updateSetting`.
- Use `PascalCase` for React components defined in `src/App.jsx`: `FruitCardFace`, `TableSeat`, `App`.
- Prefer verb-first function names for state transitions and side effects: `applyBellAvailability`, `playFeedbackSound`, `triggerBossTaunt`, `showPenalty`.
- Use `camelCase` for local variables and state: `bestSummary`, `recentSummary`, `secondsLeft`, `scoreBreakdown`, `compactCard`, `breakdownRows`.
- Use `Ref` suffix for React refs in `src/App.jsx`: `revealIntervalRef`, `countdownIntervalRef`, `feedbackTimeoutRef`, `gameStateRef`, `bellStateRef`.
- Use boolean naming that reads as a condition: `soundEnabled`, `bossDisrupting`, `isActive`, `isCurrentTurn`, `isUser`.
- TypeScript is not used. Data shapes are plain JavaScript objects created inline in `src/App.jsx`.
- Preserve object shape naming through `INITIAL_*` constants for reusable state templates: `INITIAL_SUMMARY`, `INITIAL_BREAKDOWN`.
## Code Style
- No formatter config is present. `.prettierrc*`, `biome.json`, and other formatter config files are not detected in the repo root.
- Match the existing style from `src/App.jsx`, `src/main.jsx`, and `vite.config.js`:
- JSX commonly wraps multiline props and nested ternaries across several lines instead of compressing them.
- No lint config is present. `.eslintrc*` and `eslint.config.*` are not detected.
- Follow the repository guidance in `AGENTS.md` and the live code rather than assuming standard lint defaults.
## Import Organization
- No path aliases are configured. All imports use relative paths such as `./App` and `./styles.css`.
## Error Handling
- Defensive browser guards are used before accessing browser-only APIs. `loadJson`, `saveJson`, and `ensureAudioContext` in `src/App.jsx` check `typeof window === "undefined"` before touching `window` or Web Audio APIs.
- Local storage parsing failures are swallowed and converted to safe defaults in `loadJson` at `src/App.jsx`.
- Recovery logic prefers fallback values instead of surfaced errors. Example: `loadSettings` merges stored settings over `DEFAULT_SETTINGS` in `src/App.jsx`.
- Runtime guard clauses are common for stateful event handlers. `handleBell` and `finishGame` return early when the game is not active in `src/App.jsx`.
- Async browser APIs are tolerated rather than escalated. `audioContextRef.current.resume().catch(() => {});` in `src/App.jsx` explicitly ignores resume failures.
## Logging
- `console.*` logging is not used in `src/App.jsx`, `src/main.jsx`, `vite.config.js`, or `README.md`.
- User-facing feedback is rendered in UI state instead of being logged, via `feedback`, `penaltyNotice`, and `bossTaunt` in `src/App.jsx`.
## Comments
- Inline comments are effectively absent in application code. `src/App.jsx`, `src/main.jsx`, and `src/styles.css` rely on naming and structure instead of explanatory comments.
- New comments should be added only when the logic is materially harder to infer than the existing helpers and state names.
- Not used. No JSDoc or TSDoc blocks are present in `src/`.
## Function Design
- Utility helpers are small and single-purpose near the top of `src/App.jsx`.
- The main `App` component in `src/App.jsx` is large and contains state, timers, persistence, audio, game rules, and rendering in one file. New code should still prefer extracting helper functions before adding more inline logic.
- Simple positional parameters are used for domain helpers, for example `createCard(serial, fruitKey, count)` and `takePenaltyCards(player, count)` in `src/App.jsx`.
- Object parameters are used when a function needs several optional values or reads better by name, for example `playTone({ frequency, duration, type, gain, delay })` in `src/App.jsx`.
- Pure helpers return plain values or plain objects, for example:
- State setters use functional updates when derived from previous state, for example `setWrongHits((value) => value + 1)` in `src/App.jsx`.
## Module Design
- Default export only for the main component. `src/App.jsx` ends with `export default App;`.
- Supporting helpers and child components stay file-local inside `src/App.jsx`. There are no named exports in `src/`.
- Not used. No `index.js` or barrel re-export pattern exists under `src/`.
## Validation And Data Integrity
- Settings persistence is normalized through `DEFAULT_SETTINGS` plus stored overrides in `loadSettings` at `src/App.jsx`; this is the current configuration validation pattern.
- Supported player counts are constrained by UI selection and matching seat maps in `getSeatLayouts` in `src/App.jsx`. Add new player counts only if both the selection buttons and `getSeatLayouts` are updated together.
- Bell availability is recomputed from visible card totals through `applyBellAvailability` in `src/App.jsx`; this central function is the authoritative game-rule validation point.
- Score values are clamped with `Math.max(0, ...)` when penalties apply in `advanceTurn`, `handleBell`, and `finishGame` in `src/App.jsx`.
- Browser persistence keys are centralized as constants near the top of `src/App.jsx`: `SETTINGS_KEY`, `BEST_KEY`, and `RECENT_KEY`.
## CSS And UI Conventions
- CSS classes use kebab-case throughout `src/styles.css`: `.boss-card`, `.hero-rule`, `.score-reel-list`, `.table-seat`, `.bell-button`.
- Variant styling is expressed with additive classes instead of BEM modifiers, for example `.chip.active`, `.feedback.success`, `.feedback.error`, `.feedback.warn`, and `.play-topbar.minimal` in `src/styles.css`.
- Dynamic classes are assembled inline in JSX in `src/App.jsx`, often with ternaries rather than utility helpers.
- CSS custom properties are used for layout tuning inside component-scoped containers, for example `--table-min-height`, `--card-width`, and `--pip-size` under `.table-scene*` in `src/styles.css`.
## Practical Guidance For New Code
- Keep new domain helpers above `App` in `src/App.jsx` unless there is a clear reason to split files.
- Match the current import order and string/semicolon style used in `src/main.jsx` and `src/App.jsx`.
- Prefer explicit constant tables for UI copy and configuration, following `FRUITS`, `MODES`, `COPY`, and `PIP_LAYOUTS` in `src/App.jsx`.
- When adding browser-dependent behavior, guard it like `loadJson`, `saveJson`, and `ensureAudioContext` in `src/App.jsx`.
- When adding new UI state, pair it with functional state updates and cleanup logic if timers or intervals are involved, following the `*Ref` timer pattern in `src/App.jsx`.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- `src/main.jsx` is a thin bootstrap that mounts a single exported root component from `src/App.jsx`.
- `src/App.jsx` combines domain model helpers, persistence helpers, timer orchestration, input handling, and all three screen renders in one file.
- UI state is screen-driven through `screen === "home" | "play" | "result"` branches in `src/App.jsx`, with no router and no separate state library.
## Layers
- Purpose: Start the browser app and attach the React tree to the DOM.
- Location: `index.html`, `src/main.jsx`
- Contains: The root mount node, Vite entry script, `ReactDOM.createRoot`, and global stylesheet import.
- Depends on: `react`, `react-dom`, `src/App.jsx`, `src/styles.css`
- Used by: The browser runtime through the `<script type="module" src="/src/main.jsx">` tag in `index.html`
- Purpose: Own the Halligalli simulation, scoring, persistence, timers, and screen transitions.
- Location: `src/App.jsx`
- Contains: Static configuration (`FRUITS`, `MODES`, `COPY`), helper functions (`createDeck`, `createPlayers`, `visibleTotals`, `collectFaceUpCards`), local component definitions (`FruitCardFace`, `TableSeat`), and the `App` component.
- Depends on: React hooks, `window.localStorage`, `window.setInterval`, `window.setTimeout`, keyboard events, and Web Audio APIs.
- Used by: `src/main.jsx`
- Purpose: Style the landing screen, game table, bell state, boss mode, and result screen.
- Location: `src/styles.css`
- Contains: Global typography and background styles plus component-level class rules such as `.app-shell`, `.table-felt`, `.center-bell`, `.boss-card`, and `.score-row`.
- Depends on: Class names emitted from `src/App.jsx`
- Used by: `src/main.jsx` via `import "./styles.css"`
- Purpose: Serve non-code assets referenced directly by the UI.
- Location: `public/yang-boss.png`
- Contains: Boss portrait image used on the home and play screens.
- Depends on: Vite public asset serving
- Used by: `<img src="/yang-boss.png" ... />` in `src/App.jsx`
- Purpose: Capture product intent outside the runtime code.
- Location: `README.md`, `docs/prd-web-halligalli.md`, `AGENTS.md`
- Contains: Setup guidance, product requirements, and repo instructions.
- Depends on: None at runtime
- Used by: Developers only
## Data Flow
## State Management
- `App` in `src/App.jsx` owns all mutable application state through `useState`.
- There is no context provider, reducer, or external store; child components `FruitCardFace` and `TableSeat` are presentational and receive all data via props.
- Screen/navigation state: `screen`
- Settings/persistence state: `settings`, `bestSummary`, `recentSummary`
- Core simulation state: `players`, `currentTurn`, `actingPlayer`, `secondsLeft`
- Scoring state: `score`, `correctHits`, `wrongHits`, `missedHits`, `reactionTimes`, `streak`, `scoreBreakdown`
- Feedback state: `feedback`, `activeBellFruit`, `penaltyNotice`, `bossTaunt`, `bossDisrupting`, `tauntEchoes`
- `gameStateRef` stores a current snapshot so interval callbacks avoid stale closures.
- `gameRunningRef` gates timer-driven work after a round ends.
- `bellStateRef` stores whether a valid bell window exists and when it started.
- Timeout and interval refs (`revealIntervalRef`, `countdownIntervalRef`, `feedbackTimeoutRef`, `penaltyTimeoutRef`, `bossTauntTimeoutRef`) centralize cleanup in `stopGameLoops()`.
## Key Abstractions
- Purpose: Represent one simulated seat at the table.
- Examples: `createPlayers()`, `flipCardForPlayer()`, `recycleDrawPile()` in `src/App.jsx`
- Pattern: Plain object records with `drawPile`, `wonPile`, and `faceUpPile` arrays.
- Purpose: Produce the shuffled practice deck and assign it across players.
- Examples: `createCard()`, `createDeck()`, `shuffle()` in `src/App.jsx`
- Pattern: Deterministic distribution rules plus a randomized order.
- Purpose: Translate player count into visual table positions and the user seat.
- Examples: `getSeatLayouts()` in `src/App.jsx`
- Pattern: Static coordinate tables keyed by `3`, `4`, `5`, and `6` players.
- Purpose: Detect valid bell windows and resolve success, miss, or penalty outcomes.
- Examples: `visibleTotals()`, `applyBellAvailability()`, `handleBell()`, `advanceTurn()` in `src/App.jsx`
- Pattern: Derived totals from face-up cards plus imperative refs for timing-sensitive state.
## Entry Points
- Location: `index.html`
- Triggers: Browser page load
- Responsibilities: Define the root DOM node and point Vite to `src/main.jsx`
- Location: `src/main.jsx`
- Triggers: Imported by `index.html`
- Responsibilities: Import global CSS, create the React root, and render `App`
- Location: `src/App.jsx`
- Triggers: Rendered by `src/main.jsx`
- Responsibilities: Initialize state, expose the home screen, start and stop rounds, and render all app screens
## Error Handling
- `loadJson()` in `src/App.jsx` wraps `JSON.parse` in `try/catch` and falls back to defaults if local storage data is invalid.
- Browser-only APIs are guarded with checks such as `typeof window === "undefined"` in `loadJson()`, `saveJson()`, and `ensureAudioContext()`.
- Timer and audio cleanup is centralized in `stopGameLoops()` and the unmount cleanup effect in `src/App.jsx`.
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
