# Coding Conventions

**Analysis Date:** 2026-04-06

## Naming Patterns

**Files:**
- Use `PascalCase` for the main React component file: `src/App.jsx`.
- Use lowercase entrypoint naming for bootstrapping files: `src/main.jsx`.
- Use lowercase kebab-style names for stylesheet files: `src/styles.css`.
- Keep static assets in `public/` with descriptive kebab-case names: `public/yang-boss.png`.

**Functions:**
- Use `camelCase` for utilities and event/state helpers in `src/App.jsx`: `loadJson`, `loadSettings`, `saveJson`, `createDeck`, `getSeatLayouts`, `visibleTotals`, `startGame`, `handleBell`, `finishGame`, `updateSetting`.
- Use `PascalCase` for React components defined in `src/App.jsx`: `FruitCardFace`, `TableSeat`, `App`.
- Prefer verb-first function names for state transitions and side effects: `applyBellAvailability`, `playFeedbackSound`, `triggerBossTaunt`, `showPenalty`.

**Variables:**
- Use `camelCase` for local variables and state: `bestSummary`, `recentSummary`, `secondsLeft`, `scoreBreakdown`, `compactCard`, `breakdownRows`.
- Use `Ref` suffix for React refs in `src/App.jsx`: `revealIntervalRef`, `countdownIntervalRef`, `feedbackTimeoutRef`, `gameStateRef`, `bellStateRef`.
- Use boolean naming that reads as a condition: `soundEnabled`, `bossDisrupting`, `isActive`, `isCurrentTurn`, `isUser`.

**Types:**
- TypeScript is not used. Data shapes are plain JavaScript objects created inline in `src/App.jsx`.
- Preserve object shape naming through `INITIAL_*` constants for reusable state templates: `INITIAL_SUMMARY`, `INITIAL_BREAKDOWN`.

## Code Style

**Formatting:**
- No formatter config is present. `.prettierrc*`, `biome.json`, and other formatter config files are not detected in the repo root.
- Match the existing style from `src/App.jsx`, `src/main.jsx`, and `vite.config.js`:
  - 2-space indentation
  - semicolons
  - double quotes for strings and imports
  - trailing commas in multiline arrays, objects, and function calls
- JSX commonly wraps multiline props and nested ternaries across several lines instead of compressing them.

**Linting:**
- No lint config is present. `.eslintrc*` and `eslint.config.*` are not detected.
- Follow the repository guidance in `AGENTS.md` and the live code rather than assuming standard lint defaults.

## Import Organization

**Order:**
1. External package imports first, for example `import { useEffect, useRef, useState } from "react";` in `src/App.jsx`.
2. Local component/style imports second, for example `import App from "./App";` and `import "./styles.css";` in `src/main.jsx`.
3. Side-effect-only imports appear after local module imports, as in `src/main.jsx`.

**Path Aliases:**
- No path aliases are configured. All imports use relative paths such as `./App` and `./styles.css`.

## Error Handling

**Patterns:**
- Defensive browser guards are used before accessing browser-only APIs. `loadJson`, `saveJson`, and `ensureAudioContext` in `src/App.jsx` check `typeof window === "undefined"` before touching `window` or Web Audio APIs.
- Local storage parsing failures are swallowed and converted to safe defaults in `loadJson` at `src/App.jsx`.
- Recovery logic prefers fallback values instead of surfaced errors. Example: `loadSettings` merges stored settings over `DEFAULT_SETTINGS` in `src/App.jsx`.
- Runtime guard clauses are common for stateful event handlers. `handleBell` and `finishGame` return early when the game is not active in `src/App.jsx`.
- Async browser APIs are tolerated rather than escalated. `audioContextRef.current.resume().catch(() => {});` in `src/App.jsx` explicitly ignores resume failures.

## Logging

**Framework:** None

**Patterns:**
- `console.*` logging is not used in `src/App.jsx`, `src/main.jsx`, `vite.config.js`, or `README.md`.
- User-facing feedback is rendered in UI state instead of being logged, via `feedback`, `penaltyNotice`, and `bossTaunt` in `src/App.jsx`.

## Comments

**When to Comment:**
- Inline comments are effectively absent in application code. `src/App.jsx`, `src/main.jsx`, and `src/styles.css` rely on naming and structure instead of explanatory comments.
- New comments should be added only when the logic is materially harder to infer than the existing helpers and state names.

**JSDoc/TSDoc:**
- Not used. No JSDoc or TSDoc blocks are present in `src/`.

## Function Design

**Size:** 
- Utility helpers are small and single-purpose near the top of `src/App.jsx`.
- The main `App` component in `src/App.jsx` is large and contains state, timers, persistence, audio, game rules, and rendering in one file. New code should still prefer extracting helper functions before adding more inline logic.

**Parameters:**
- Simple positional parameters are used for domain helpers, for example `createCard(serial, fruitKey, count)` and `takePenaltyCards(player, count)` in `src/App.jsx`.
- Object parameters are used when a function needs several optional values or reads better by name, for example `playTone({ frequency, duration, type, gain, delay })` in `src/App.jsx`.

**Return Values:**
- Pure helpers return plain values or plain objects, for example:
  - `visibleTotals(players)` returns a totals object in `src/App.jsx`
  - `flipCardForPlayer(player)` returns `{ player, card }` in `src/App.jsx`
  - `collectFaceUpCards(players, winnerId)` returns `{ players, collectedCount }` in `src/App.jsx`
- State setters use functional updates when derived from previous state, for example `setWrongHits((value) => value + 1)` in `src/App.jsx`.

## Module Design

**Exports:**
- Default export only for the main component. `src/App.jsx` ends with `export default App;`.
- Supporting helpers and child components stay file-local inside `src/App.jsx`. There are no named exports in `src/`.

**Barrel Files:**
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

---

*Convention analysis: 2026-04-06*
