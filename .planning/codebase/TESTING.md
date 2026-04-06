# Testing Patterns

**Analysis Date:** 2026-04-06

## Test Framework

**Runner:**
- Not detected
- Config: Not detected. `vitest.config.*`, `jest.config.*`, `playwright.config.*`, and `cypress.config.*` are not present in the repository root.

**Assertion Library:**
- Not applicable. No automated assertion library is configured in `package.json`.

**Run Commands:**
```bash
npm run dev       # Run the app locally for interactive gameplay checks
npm run build     # Validate that the production bundle compiles successfully
npm run preview   # Smoke test the built bundle locally
```

## Test File Organization

**Location:**
- No automated test files are present. A repository-wide scan for `*.test.*` and `*.spec.*` returns no results.

**Naming:**
- Not applicable in the live codebase.
- The repo guidance in `AGENTS.md` says future tests should be named like `App.test.jsx` and placed beside the source file or under `src/__tests__/`.

**Structure:**
```text
Current state:
- No `src/__tests__/` directory
- No co-located `*.test.*` or `*.spec.*` files
```

## Test Structure

**Suite Organization:**
```typescript
// No automated suites exist in the current repository.
```

**Patterns:**
- Verification is manual and centered on gameplay behavior in `src/App.jsx`.
- The baseline release check is `npm run build`, which is also documented in `README.md`.
- Interactive checks should exercise the three app screens implemented in `src/App.jsx`:
  - home/setup screen
  - play screen
  - result screen

## Mocking

**Framework:** Not applicable

**Patterns:**
```typescript
// No mocking framework or mock modules are present.
```

**What to Mock:**
- Not established in the current repo.
- If automated tests are added later, the most isolated seams are browser APIs used in `src/App.jsx`:
  - `window.localStorage`
  - `window.AudioContext` / `window.webkitAudioContext`
  - timers used through `window.setInterval`, `window.clearInterval`, `window.setTimeout`, and `window.clearTimeout`
  - keyboard events for the space-bar bell shortcut

**What NOT to Mock:**
- Current manual verification relies on real browser rendering and real UI interaction, so layout and click behavior should be exercised against the rendered app rather than abstracted away.

## Fixtures and Factories

**Test Data:**
```typescript
// Existing reusable data patterns live in `src/App.jsx` and should become test fixtures if tests are added:
const DEFAULT_SETTINGS = {
  difficulty: "normal",
  duration: 60,
  playerCount: 4,
  language: "zh",
  soundEnabled: true,
};

const INITIAL_SUMMARY = {
  score: 0,
  correctHits: 0,
  wrongHits: 0,
  missedHits: 0,
  accuracy: 0,
  avgReactionMs: 0,
  bestReactionMs: 0,
  difficulty: DEFAULT_SETTINGS.difficulty,
  durationSec: DEFAULT_SETTINGS.duration,
  playerCount: DEFAULT_SETTINGS.playerCount,
};
```

**Location:**
- No fixture or factory directory exists.
- Reusable game setup data currently lives inline in `src/App.jsx` as constants and helper functions such as `FRUITS`, `MODES`, `createDeck`, `createPlayers`, and `getSeatLayouts`.

## Coverage

**Requirements:** None enforced

**View Coverage:**
```bash
# Not available; no coverage tooling is configured.
```

## Test Types

**Unit Tests:**
- Not used.
- Natural unit boundaries exist inside `src/App.jsx` if the repo adds tests later:
  - deck generation: `createCard`, `createDeck`, `shuffle`
  - board math: `getTopCard`, `sumVisible`, `visibleTotals`, `totalTableCards`
  - scoring and summary helpers: `calcAccuracy`, `sumBreakdown`, `modeLabel`, `fruitLabel`
  - state transitions that currently return plain objects: `flipCardForPlayer`, `takePenaltyCards`, `collectFaceUpCards`

**Integration Tests:**
- Not used.
- The closest current equivalent is manual browser testing of full flows driven by `startGame`, `handleBell`, and `finishGame` in `src/App.jsx`.

**E2E Tests:**
- Not used.

## Current Manual Verification Workflow

- Run `npm run dev` and validate the setup screen in `src/App.jsx`:
  - language toggle switches between Chinese and English copy
  - sound toggle updates the selected chip state
  - player-count chips work for 3, 4, 5, and 6 players
  - difficulty and duration chips update correctly
- Start a round and verify the play screen:
  - cards flip clockwise around the table
  - only top visible cards count toward bell availability
  - pressing the bell button and the space bar both trigger `handleBell`
  - wrong rings show penalty feedback
  - missed bell windows increment the missed state and show warning feedback
  - Boss mode surfaces taunt UI and disruption effects
- Finish a round and verify the result screen:
  - summary metrics are populated
  - score breakdown rows animate and only show non-zero items
  - recent and best summaries persist across reloads through local storage
- Run `npm run build` to validate the production build.
- Run `npm run preview` for a final smoke test against the generated `dist/` bundle.

## Common Patterns

**Async Testing:**
```typescript
// No async test harness exists.
// The codebase does use timers extensively in `src/App.jsx`,
// so future tests will need to control interval- and timeout-driven state.
```

**Error Testing:**
```typescript
// No error test pattern exists.
// The nearest defensive behavior is fallback handling such as:
// - invalid localStorage JSON returning a fallback via `loadJson`
// - browser API absence returning early in `ensureAudioContext`
```

## Practical Guidance For Adding Tests

- Place the first tests beside `src/App.jsx` or under `src/__tests__/`, matching the repo guidance in `AGENTS.md`.
- Start with pure helper coverage from `src/App.jsx` before attempting timer-heavy UI tests.
- Add at least one browser-level integration test for the core loop: start round, hit bell correctly, finish round, confirm result summary.
- If a test runner is introduced, document the new commands in `package.json` and update `README.md` so the current manual workflow remains discoverable.

---

*Testing analysis: 2026-04-06*
