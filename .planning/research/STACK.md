# Stack Research

**Research Date:** 2026-04-06
**Milestone Context:** Subsequent milestone on an existing local-first Halligalli trainer

## Recommendation Summary

Keep the current React + Vite + plain CSS stack for the next milestone. The product gap is mostly product structure, feedback clarity, and gameplay correctness, not framework capability. Add only the minimum supporting tooling needed to make rule changes safe and mobile polish measurable.

## Keep

### React 19 + Vite 7

- **Recommendation:** Keep as-is
- **Why:** The current app is already shipping on this stack, and the near-term work is UI flow and gameplay refactoring, not platform migration
- **Confidence:** High

### Plain CSS

- **Recommendation:** Keep as-is for now
- **Why:** Styling is already centralized in `src/styles.css`, and the PRD emphasizes product feel and responsive layout rather than design-system scale
- **Confidence:** High

### Browser localStorage

- **Recommendation:** Keep for settings, recent summary, best summary, and lightweight progress flags
- **Why:** The PRD explicitly allows no-login local persistence for MVP, and this keeps the product frictionless
- **Confidence:** High

## Add Next

### Vitest

- **Recommendation:** Add `vitest` for pure gameplay logic and summary math
- **Why:** The current game engine is timing-sensitive and currently unprotected by tests; extracting rule helpers without tests is the highest refactor risk in the repo
- **Use for:** visible totals, bell availability, penalties, scoring, unresolved bell windows at round end
- **Confidence:** High

### React Testing Library

- **Recommendation:** Add React Testing Library once tutorial and new screen flow land
- **Why:** The next milestone adds onboarding and richer feedback, which benefits from screen-level interaction tests rather than only pure logic tests
- **Use for:** tutorial progression, start flow, results actions, language parity on critical controls
- **Confidence:** Medium

### Lightweight schema validation for local storage payloads

- **Recommendation:** Introduce a small runtime validator for persisted settings and summaries
- **Why:** The codebase map already found that malformed storage can break render assumptions; this is a real brownfield bug, not optional polish
- **Use for:** clamping saved `playerCount`, `difficulty`, durations, and summary shapes
- **Confidence:** High

## Defer

### State management library

- **Recommendation:** Do not add Redux, Zustand, or XState yet
- **Why not yet:** The immediate need is extracting a pure game engine and smaller UI modules, not introducing another abstraction layer before the boundaries exist
- **Confidence:** Medium

### CSS-in-JS or utility framework

- **Recommendation:** Do not introduce Tailwind or CSS-in-JS in this milestone
- **Why not yet:** The styling system is not the bottleneck; responsive clarity and interaction polish can be delivered inside the current CSS approach
- **Confidence:** High

### Backend, auth, or analytics service

- **Recommendation:** Do not add remote infrastructure in this milestone
- **Why not yet:** Accounts, sync, leaderboards, and production analytics are out of current scope; local event logging structure can be prepared without a remote dependency
- **Confidence:** High

## Implementation Posture

### Module split to target first

- `src/game/` for pure deck, reveal, bell, penalty, and summary logic
- `src/hooks/` for timers, persistence, audio, and round orchestration
- `src/components/` for home, tutorial, table, bell, feedback, and result UI sections
- `src/content/` or local constants modules for bilingual copy and training text

### Product features to support with the current stack

- Tutorial flow with explanatory examples
- More explicit correct / wrong / missed feedback
- Stronger result screen with progress framing
- Mobile-first interaction polish
- Safer persisted settings and summary recovery

## What Not To Add Yet

| Candidate | Why Not Yet |
|-----------|-------------|
| Backend API | No MVP requirement depends on it |
| Account system | Adds friction before the core training loop is validated |
| Real-time features | Out of scope and architecture-changing |
| Large UI framework | Existing app is too small to justify migration cost |
| Heavy animation library | Core game feedback can be delivered with CSS and small React state transitions |

## Risks To Watch

- Refactoring without tests will create invisible rule regressions
- New tutorial logic added directly to `App.jsx` will deepen the monolith and slow every later phase
- Mobile fixes done only in CSS, without rethinking interaction zones, may miss the PRD's one-hand usability target

## Recommended Sequence

1. Extract pure game logic and add tests around it
2. Stabilize persistence validation and end-of-round correctness
3. Split screen-level UI modules
4. Add tutorial and richer feedback flows
5. Polish mobile layout and accessibility

---
*Stack research completed: 2026-04-06*
