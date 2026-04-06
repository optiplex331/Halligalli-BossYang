# Phase 1: Foundation And Game Integrity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 1-Foundation And Game Integrity
**Areas discussed:** Rule engine boundary, Persistence validation, Timing and lifecycle integrity, Test harness and coverage

---

## Rule engine boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Extract pure rules first | Move gameplay evaluation and summary logic into standalone modules while keeping current behavior stable | ✓ |
| Keep logic in App for now | Patch bugs in place and defer extraction to a later phase | |
| Full architectural rewrite | Break up screens, hooks, state, and rules all at once | |

**User's choice:** [auto] Extract pure rules first
**Notes:** Recommended default. Best matches Phase 1 scope and the codebase concern that `src/App.jsx` is the fragile monolith.

---

## Persistence validation

| Option | Description | Selected |
|--------|-------------|----------|
| Validate and clamp local data | Preserve localStorage keys but sanitize unsupported values before use | ✓ |
| Ignore malformed values silently | Keep today's fallback behavior and only patch crashes as found | |
| Introduce new persistence model | Start redesigning around accounts or remote sync | |

**User's choice:** [auto] Validate and clamp local data
**Notes:** Recommended default. Preserves current product scope while satisfying `PER-01`.

---

## Timing and lifecycle integrity

| Option | Description | Selected |
|--------|-------------|----------|
| Reconcile final bell windows and timer cleanup now | Fix round-end misses and restart races as part of the integrity pass | ✓ |
| Only patch the known final bell bug | Address one bug and defer broader lifecycle cleanup | |
| Leave timing untouched | Focus only on extraction and tests | |

**User's choice:** [auto] Reconcile final bell windows and timer cleanup now
**Notes:** Recommended default. Phase 1 explicitly covers round-end timing boundaries and restart safety.

---

## Test harness and coverage

| Option | Description | Selected |
|--------|-------------|----------|
| Add tests around extracted pure modules first | Cover rule evaluation, penalties, summaries, and storage validation with fast automated tests | ✓ |
| Add UI tests first | Prove behavior mainly through rendered component interaction | |
| Skip automation and rely on build + manual play | Keep the current validation model | |

**User's choice:** [auto] Add tests around extracted pure modules first
**Notes:** Recommended default. Gives the phase a durable quality gate without coupling everything to UI rendering.

---

## the agent's Discretion

- Exact filenames and module boundaries for the extracted game engine
- Exact validation helper structure for persisted data
- Test file placement and runner wiring, as long as it fits the existing Vite repo cleanly

## Deferred Ideas

None
