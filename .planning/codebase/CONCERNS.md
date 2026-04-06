# Codebase Concerns

**Analysis Date:** 2026-04-06

## Tech Debt

**Gameplay state machine concentrated in one component:**
- Issue: Core rules, persistence, audio, timer orchestration, scoring, and all three screens live in `src/App.jsx`, which is 1363 lines and mixes pure game rules with React rendering concerns.
- Files: `src/App.jsx`
- Impact: Small rule changes require editing a high-churn file with multiple async side effects, making regressions in turn order, bell handling, and result summaries more likely.
- Fix approach: Extract pure gameplay helpers into a separate module first, then move persistence/audio/timer orchestration behind focused hooks so UI work and rule work stop sharing the same edit surface.

**No automated quality gate:**
- Issue: The repository has no test runner, no lint script, and no validation script beyond production build output.
- Files: `package.json`, `src/App.jsx`, `src/main.jsx`, `src/styles.css`
- Impact: Gameplay regressions are detectable only by manual playthroughs, which is weak coverage for timer races and score accounting.
- Fix approach: Add a test runner and basic assertions around deck creation, bell availability, penalty handling, and result summary generation before expanding the feature set.

## Known Bugs

**Corrupted local settings can crash the app on first render:**
- Symptoms: If `halligalli_settings` in `localStorage` contains unsupported values such as an invalid `playerCount` or `difficulty`, render-time lookups can fail before the home screen loads.
- Files: `src/App.jsx`
- Trigger: `loadSettings()` merges arbitrary saved JSON into defaults at `src/App.jsx:245`, then render assumes the values are valid at `src/App.jsx:604`, `src/App.jsx:605`, and `src/App.jsx:606`.
- Workaround: Clear browser storage for the app. The durable fix is schema validation and clamping before values reach `MODES[...]` or `getSeatLayouts(...)`.

**Final missed bell can be dropped when the round ends:**
- Symptoms: A valid bell window that is still open when the timer expires is not recorded as a miss and does not apply the documented missed-hit penalty.
- Files: `src/App.jsx`
- Trigger: Misses are only charged inside `advanceTurn()` at `src/App.jsx:819`-`src/App.jsx:829`, but `finishGame()` at `src/App.jsx:993`-`src/App.jsx:1041` reads the current snapshot without checking `bellStateRef.current` first.
- Workaround: None in the UI. Fix by reconciling unresolved bell state inside `finishGame()` before summary calculation.

**Persist writes can throw and break the session:**
- Symptoms: Browsers that block or quota-limit storage can throw during settings or score saves, causing the app to error after interaction rather than quietly degrading.
- Files: `src/App.jsx`
- Trigger: `saveJson()` writes directly with no `try/catch` at `src/App.jsx:253`-`src/App.jsx:258`, and it is called from the settings effect at `src/App.jsx:617`-`src/App.jsx:619` plus result persistence at `src/App.jsx:1033`-`src/App.jsx:1038`.
- Workaround: None in code. Wrap writes and optionally disable persistence after the first storage failure.

## Security Considerations

**Client-side persisted state is fully trusted:**
- Risk: Any script running in the same origin, or a user manually editing storage, can inject malformed values that influence render paths and scoring summaries.
- Files: `src/App.jsx`
- Current mitigation: `loadJson()` catches invalid JSON syntax at `src/App.jsx:232`-`src/App.jsx:243`.
- Recommendations: Validate shape and allowed enums for `halligalli_settings`, `halligalli_best`, and `halligalli_recent` before use; reject unknown keys and clamp numeric ranges.

**No external network or credential surface detected:**
- Risk: Not applicable for backend data exposure because the app is static and local-only in the current codebase.
- Files: `package.json`, `vite.config.js`, `src/main.jsx`
- Current mitigation: No API clients, auth providers, or secret-bearing config were detected in the live repo.
- Recommendations: Keep it this way unless a future feature requires remote persistence; if that happens, add server-side validation before trusting any client score data.

## Performance Bottlenecks

**Whole-screen rerender on every reveal tick:**
- Problem: Every card reveal and bell action updates top-level state in `App`, forcing the entire play screen, feedback banner, boss layer, seat list, and result bookkeeping to rerender at the game cadence.
- Files: `src/App.jsx`
- Cause: State for gameplay, UI feedback, score breakdown, and boss presentation all lives in a single component rooted at `src/App.jsx:559`-`src/App.jsx:597`, and reveal ticks run as fast as every 900 ms in Boss mode at `src/App.jsx:899`-`src/App.jsx:902`.
- Improvement path: Split seat rendering, boss overlay, and summary bookkeeping into memoizable child components after extracting pure state transitions.

**Timer loop orchestration depends on repeated cloning:**
- Problem: Each reveal and wrong-bell path clones player structures and face-up piles, even though only one seat changes on a normal reveal.
- Files: `src/App.jsx`
- Cause: `clonePlayers()` at `src/App.jsx:476`-`src/App.jsx:482` is used in `advanceTurn()` and `handleBell()`, and player data contains three arrays per seat.
- Improvement path: Keep pure immutable transitions, but scope updates to affected seats and derived table totals rather than cloning the full table on every action.

## Fragile Areas

**Untracked startup timeout can race with restart or unmount:**
- Files: `src/App.jsx`
- Why fragile: `startGame()` schedules an immediate `setTimeout(..., 0)` at `src/App.jsx:880`-`src/App.jsx:897`, but `stopGameLoops()` only clears interval and timeout refs for other timers at `src/App.jsx:665`-`src/App.jsx:670`. Rapid restarts or unmount during startup can leave that callback alive.
- Safe modification: Put the startup timeout behind a ref and clear it alongside the other loop handles before adding more boot-time async work.
- Test coverage: No automated coverage exists for start/stop race conditions.

**Bell availability and summary logic are spread across refs and state:**
- Files: `src/App.jsx`
- Why fragile: Whether a bell was available lives in `bellStateRef`, while score, misses, and summaries live in React state plus `gameStateRef`. Any new rule can easily update one store and forget the others.
- Safe modification: Centralize round transition functions around a single source of truth before adding tutorial mode, endless mode, or richer scoring.
- Test coverage: No unit tests cover `applyBellAvailability()`, `advanceTurn()`, `handleBell()`, or `finishGame()`.

**Language and copy are not consistently wired into controls:**
- Files: `src/App.jsx`
- Why fragile: Most labels use the translation table, but the bell button text is hard-coded as `铃` at `src/App.jsx:1248`-`src/App.jsx:1251`, which will drift further as more UI is localized.
- Safe modification: Route all visible copy through `COPY` and give interactive controls explicit accessible labels.
- Test coverage: No snapshot or UI tests exist to catch localization regressions.

## Scaling Limits

**Feature growth is capped by the current single-file architecture:**
- Current capacity: One gameplay mode with local-only persistence and one main screen flow is manageable inside `src/App.jsx`.
- Limit: Adding tutorial logic, analytics, cloud sync, or multiple game modes into the current component will increase rule coupling and make simple UI edits risky.
- Scaling path: Split the app into modules by concern now: `game/` for rules, `hooks/` for timers and persistence, and presentational components for table/boss/result sections.

## Dependencies at Risk

**Minimal dependency surface, but no tooling dependency for correctness:**
- Risk: The runtime stack is small, but there is no linting or test dependency to catch incorrect hook changes or rule regressions.
- Impact: Bugs in `src/App.jsx` reach production as long as the bundle still builds.
- Migration plan: Add `vitest` plus React Testing Library first; add ESLint only after the basic test harness is in place.

## Missing Critical Features

**No regression harness for scoring and rule enforcement:**
- Problem: Core expectations from `docs/prd-web-halligalli.md` such as accurate miss detection, reaction timing, and end-of-round summaries rely entirely on manual verification.
- Blocks: Safe refactors to `src/App.jsx`, reliable bug fixes for timing edge cases, and confident expansion into tutorial or history features.

## Test Coverage Gaps

**Gameplay transition logic is untested:**
- What's not tested: Deck generation, clockwise turn advancement, visible total calculation, correct bell collection, wrong-bell penalty handling, and final summary math.
- Files: `src/App.jsx`
- Risk: Regressions in core rules will only be found by manual play, and timing bugs can be intermittent.
- Priority: High

**Persistence fallback paths are untested:**
- What's not tested: Invalid `localStorage` payloads, blocked storage writes, and recovery from malformed saved summaries.
- Files: `src/App.jsx`
- Risk: Browser-specific failures can break first load or end-of-round saving without any automated signal.
- Priority: High

**Responsive table layout is untested:**
- What's not tested: Seat placement and bell overlap across 3-6 players at the breakpoints defined in `src/styles.css`.
- Files: `src/styles.css`, `src/App.jsx`
- Risk: Mobile and small-table layouts can become unusable after innocent CSS tweaks.
- Priority: Medium

---

*Concerns audit: 2026-04-06*
