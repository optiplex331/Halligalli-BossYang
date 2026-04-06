# Phase 1: Foundation And Game Integrity - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase stabilizes the existing Halligalli practice loop so later tutorial, feedback, and responsive-product work can build on trustworthy behavior. Scope is limited to extracting and hardening rule/persistence/timing logic, fixing known integrity edge cases, and adding automated coverage around the current game engine behavior.

</domain>

<decisions>
## Implementation Decisions

### Rule Engine Boundary
- **D-01:** Extract the core game-rule logic out of `src/App.jsx` into pure JavaScript modules under `src/` so tutorial and live play can share the same source of truth later.
- **D-02:** Preserve current gameplay semantics during extraction; this phase is for correctness and testability, not for changing scoring, deck composition, or introducing new product behavior.
- **D-03:** Prioritize extraction around bell evaluation, visible totals, turn advancement, penalties, and summary generation because these functions define the current product contract and map directly to Phase 1 requirements.

### Persistence Validation
- **D-04:** Keep browser `localStorage` as the persistence layer for v1, but add schema-like validation and safe clamping before saved values are consumed by render or summary code.
- **D-05:** Treat malformed settings and stored summaries as recoverable input: fall back to defaults or known-safe shapes instead of surfacing errors or crashing the app.
- **D-06:** Keep existing storage keys and local-only product shape intact so this phase hardens the current model instead of widening scope into accounts or sync.

### Timing And Lifecycle Integrity
- **D-07:** Fix unresolved bell-window handling at round end so missed opportunities are reconciled consistently before final summary calculation.
- **D-08:** Bring startup, restart, and cleanup paths under explicit timer/ref control so rapid round restarts or unmounts cannot leave orphaned callbacks running.
- **D-09:** Preserve the current playable cadence and UI flow while making lifecycle behavior deterministic enough to test.

### Test Harness And Coverage
- **D-10:** Add an automated test harness in this phase because extracted pure logic is only valuable if the repo can verify it without manual playthroughs.
- **D-11:** Focus initial automated coverage on visible-total evaluation, ring correctness, penalty handling, end-of-round summary generation, invalid persisted input, and restart / final-bell edge cases.
- **D-12:** Prefer tests against extracted pure modules first, and only add UI-level tests where behavior cannot be proven at the logic boundary.

### the agent's Discretion
- Exact module names and file split under `src/`
- Whether persistence validation lives in dedicated storage helpers or a small validation module
- Which test runner layout is cleanest for this repo, as long as it supports fast local verification and fits the existing Vite/React stack

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product Scope
- `.planning/PROJECT.md` — Product direction, constraints, and brownfield assumptions for the Halligalli trainer
- `.planning/REQUIREMENTS.md` — Phase-linked requirements, especially `PRA-02`, `PRA-03`, `PER-01`, `QLT-01`, and `QLT-02`
- `.planning/ROADMAP.md` — Phase boundary, goal, and success criteria for Phase 1
- `.planning/STATE.md` — Current project status and active phase

### Product Specification
- `docs/prd-web-halligalli.md` §13.2 — Round rhythm and reaction-window expectations
- `docs/prd-web-halligalli.md` §13.3 — Scoring expectations that Phase 1 must preserve
- `docs/prd-web-halligalli.md` §15.1 — Performance requirements relevant to timing and responsiveness
- `docs/prd-web-halligalli.md` §16.2 — Implementation risks around real-time judgment and rhythm synchronization
- `docs/prd-web-halligalli.md` §17 — MVP acceptance criteria for correct hit / miss / penalty behavior and local persistence

### Existing Code And Brownfield Constraints
- `.planning/codebase/ARCHITECTURE.md` — Current single-component architecture, state ownership, and game-loop data flow
- `.planning/codebase/CONCERNS.md` — Known bugs, fragile timing paths, and recommended hardening direction
- `.planning/codebase/CONVENTIONS.md` — Existing coding and module conventions to preserve during extraction
- `.planning/codebase/STRUCTURE.md` — Current file layout and where new shared modules or tests should live

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/App.jsx` pure helpers near the top of the file: deck generation, player manipulation, visible total calculation, card collection, and penalty helpers are the best extraction candidates for a shared rule engine.
- `COPY`, `MODES`, `DEFAULT_SETTINGS`, and storage key constants in `src/App.jsx`: keep product configuration centralized while hardening validation paths.
- `src/main.jsx` and `src/styles.css`: already form a thin bootstrap plus shared styling layer, so Phase 1 can focus on game logic and testability without needing routing or design-system work.

### Established Patterns
- Single-page React app with one stateful owner in `src/App.jsx`: Phase 1 should reduce risk incrementally rather than attempt a full architectural rewrite.
- Defensive `typeof window === "undefined"` guards already exist: extend that style into stronger storage validation and persistence write safety.
- User-facing feedback is state-driven rather than logged: integrity fixes should preserve the current UI contract while making underlying transitions deterministic.

### Integration Points
- `loadJson()`, `loadSettings()`, and `saveJson()` in `src/App.jsx`: primary persistence hardening entry points.
- `applyBellAvailability()`, `advanceTurn()`, `handleBell()`, and `finishGame()` in `src/App.jsx`: primary targets for extraction, consistency fixes, and automated verification.
- `startGame()` / `stopGameLoops()` and timer refs in `src/App.jsx`: lifecycle coordination points for restart and cleanup fixes.
- `package.json`: likely place to add the first automated test script for this repo.

</code_context>

<specifics>
## Specific Ideas

- [auto] Phase inferred as `1` because `STATE.md` marks Phase 1 as the current focus and the command omitted a phase number.
- [auto] Selected all gray areas for this phase: rule engine boundary, persistence validation, timing and lifecycle integrity, and test harness strategy.
- [auto] Recommended default chosen for extraction scope: keep behavior stable while moving pure game logic out of the monolith first.
- [auto] Recommended default chosen for persistence: validate and clamp local data instead of widening scope into new storage mechanisms.
- [auto] Recommended default chosen for lifecycle handling: explicitly reconcile final bell windows and restart timers before adding new features.
- [auto] Recommended default chosen for testing: prioritize pure logic coverage before UI-heavy tests.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---
*Phase: 01-foundation-and-game-integrity*
*Context gathered: 2026-04-06*
