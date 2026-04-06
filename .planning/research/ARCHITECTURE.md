# Architecture Research

**Research Date:** 2026-04-06
**Milestone Context:** Subsequent milestone on a monolithic client-only React app

## Recommended Structure

The next milestone should split the product into a small number of stable boundaries without over-engineering:

- `game/` for pure Halligalli rules and round transitions
- `hooks/` for timers, storage, and audio side effects
- `components/` for screen-level and table-level UI
- `content/` for bilingual copy, tutorial examples, and explanatory strings
- `app/` or top-level orchestration that wires screen flow together

This keeps the existing frontend stack intact while removing the current pressure point: one file controlling everything.

## Component Boundaries

### Game Engine Boundary

- Owns deck creation, reveal progression, visible totals, ring validation, penalty handling, scoring deltas, and round summary generation
- Must be pure and testable outside React
- Should expose evaluation metadata, not just booleans, so UI can explain mistakes

### Session Orchestration Boundary

- Owns round lifecycle, timers, refs, event subscriptions, and transitions between idle / running / finished states
- Should call the pure engine and then commit resulting state to React
- Should also reconcile end-of-round unresolved bell windows before final summary creation

### Persistence Boundary

- Owns loading, validation, clamping, and saving of settings, recent result, best result, and any lightweight tutorial completion flags
- Should degrade safely when local storage fails

### Screen/UI Boundary

- `HomeScreen`: entry, recent/best snapshot, settings access, tutorial entry
- `TutorialScreen`: guided rule explanation, examples, mini-check
- `PlayScreen`: table, bell, feedback, boss layer, countdown
- `ResultScreen`: summary, comparison, replay and follow-up actions

### Presentational Subcomponents

- `TableSeat`
- `BellButton`
- `FeedbackBanner`
- `BossOverlay`
- `SettingsPanel`
- `StatCard`

## Data Flow

### Startup Flow

1. App boot loads persisted settings and progress flags through the persistence boundary
2. App chooses the initial route or screen state
3. Home screen renders lightweight summaries and available entry points

### Tutorial Flow

1. Tutorial screen requests example scenarios from tutorial content
2. Example scenarios are evaluated through the same game-rule helpers used in live play
3. User actions advance tutorial progress and optional completion state is persisted locally

### Practice Flow

1. User starts a round with chosen settings
2. Session orchestrator initializes engine state
3. Timer or user input triggers engine transitions
4. Engine returns next state plus feedback metadata
5. React state updates the play screen
6. End-of-round summary is persisted and passed to result UI

### Result Flow

1. Result screen receives computed summary and comparison data
2. UI renders score, reaction data, error counts, and next actions
3. Replay or tutorial actions loop back into start flow without reloading the app

## Suggested Build Order

### Step 1: Extract rule engine

- Move deck, totals, bell evaluation, penalties, and summary helpers out of `App.jsx`
- Add tests before or during extraction
- This lowers risk for every later feature

### Step 2: Stabilize persistence and round-finalization edge cases

- Validate storage payloads
- Fix final unresolved bell handling
- Ensure new tutorial/progress flags have a safe home

### Step 3: Split major screens and focused UI subcomponents

- Separate screen rendering from session logic
- Keep orchestration near the top while presentational layers become smaller and safer to edit

### Step 4: Add tutorial and richer feedback metadata

- Build tutorial on top of the same evaluation helpers
- Expand engine outputs so UI can explain exactly why a ring was right or wrong

### Step 5: Improve result/progress UX and mobile usability

- Extend local progress display
- Tune layout, reachability, and accessibility after boundaries are in place

## Phase Implications

- A dedicated stabilization/refactor phase should happen before major feature expansion
- Tutorial and richer feedback should be grouped because both depend on shared rule explanation
- Mobile polish should happen after the play screen structure is modular enough to edit safely

## Architecture Rules For Future Work

- No new gameplay logic directly inside screen JSX branches
- Tutorial and gameplay must share one evaluation source of truth
- Side effects belong in hooks / orchestrators, not pure rule modules
- Persisted data must be validated before render code consumes it

---
*Architecture research completed: 2026-04-06*
