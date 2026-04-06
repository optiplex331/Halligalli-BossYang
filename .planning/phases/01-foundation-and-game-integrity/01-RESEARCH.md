# Phase 1 Research: Foundation And Game Integrity

**Date:** 2026-04-06
**Phase:** 1 - Foundation And Game Integrity

## Planning Summary

Phase 1 should optimize for one thing: making the existing Halligalli loop safe to change. The codebase already has a working product loop, so the right approach is an incremental extraction of pure game logic plus a first automated regression harness, not a wholesale architectural rewrite.

## What Matters Most

### 1. Extract pure logic before broad UI refactors

- The current risks are concentrated in `src/App.jsx`, especially the functions that compute visible totals, bell availability, penalties, round summaries, and timer transitions.
- Planning should treat pure-rule extraction as the anchor because later tutorial and feedback phases need a shared source of truth.
- The extraction boundary should stay narrow: move deterministic rule/persistence helpers first, keep screen composition in `App.jsx` for now.

### 2. Preserve current behavior unless a bug is explicitly documented

- Phase 1 is not the place to redesign scoring, deck balance, or table presentation.
- The only intentional behavior changes should be the known integrity fixes already surfaced in `.planning/codebase/CONCERNS.md`:
  - invalid persisted settings should no longer crash rendering
  - unresolved final bell windows should be reconciled before summary generation
  - startup / restart timers should be cleaned up deterministically
  - persistence writes should fail safely

### 3. Add tests where logic can be proven outside React

- Fast unit coverage around extracted modules will do more for this phase than broad UI tests.
- The first suite should cover:
  - visible total calculation
  - ring success / failure evaluation
  - penalty card movement
  - end-of-round summary generation
  - persisted settings normalization / clamping
  - final unresolved bell-window reconciliation
- Browser/UI tests can wait unless a critical behavior cannot be proven at the pure logic level.

## Suggested Technical Shape

### Rule Engine Modules

Recommended direction:
- `src/game/` or similarly small shared modules for deterministic round logic
- keep module boundaries behavior-based, not framework-based:
  - deck / player primitives
  - totals and bell evaluation
  - round summary derivation
  - persisted settings / summary normalization

Avoid:
- jumping straight to reducers, context, or external state libraries
- splitting every screen component during the same phase

### Persistence Hardening

Recommended direction:
- introduce explicit normalization helpers for:
  - settings (`difficulty`, `duration`, `playerCount`, `language`, `soundEnabled`)
  - recent / best summaries
- wrap `localStorage.setItem` in `try/catch` and degrade gracefully on failure
- preserve the current storage keys to avoid scope expansion

### Timing Integrity

Recommended direction:
- centralize timer handles so every scheduled callback can be cleared on restart/unmount
- reconcile unresolved bell state inside the finish path before metrics are finalized
- keep existing interval-driven cadence unless a change is required to eliminate an identified race

## Risks To Plan Around

- `src/App.jsx` is still the integration point, so multiple plans touching it heavily should run sequentially
- extracting logic without immediate tests will create false confidence and make later bug fixes harder
- changing persistence shape without normalization can create migration bugs in existing browser storage
- fixing the final-bell bug without corresponding tests risks reintroducing it during later tutorial work

## Recommended Plan Split

### Plan 01
- Install and wire the first automated test harness
- Extract the pure game-rule helpers needed for totals, ring evaluation, penalties, and summary math
- Add unit tests for those extracted modules

### Plan 02
- Harden settings / summary persistence with explicit normalization and safe-write behavior
- Integrate normalized persistence paths back into `src/App.jsx`
- Add regression tests for malformed stored data and persistence fallbacks

### Plan 03
- Fix lifecycle / timing integrity issues in `startGame()`, `stopGameLoops()`, and `finishGame()`
- Add regression coverage for final bell reconciliation and restart safety
- Run the full phase verification commands and confirm behavior parity

## Validation Architecture

Nyquist validation is viable for this phase because most critical behavior can be sampled through a fast unit suite. The validation contract should center on `vitest` with:

- quick command: targeted unit run for the extracted logic modules
- full command: full `vitest run` plus `npm run build`
- wave sampling:
  - after logic extraction tasks: quick unit run
  - after each plan: full test suite and build

## Deliverables The Planner Must Cover

- one or more extracted pure logic modules under `src/`
- a working automated test command in `package.json`
- regression coverage for the mapped requirements: `PRA-02`, `PRA-03`, `PER-01`, `QLT-01`, `QLT-02`
- preserved gameplay behavior outside the explicitly fixed integrity bugs

---
*Research complete: 2026-04-06*
