# Pitfalls Research

**Research Date:** 2026-04-06
**Milestone Context:** Expanding a working Halligalli MVP into a broader training product

## Pitfall 1: Shipping More UI On Top Of Unstable Rule Logic

- **Why it happens:** Tutorial, richer feedback, and new modes all depend on trustworthy rule evaluation, but the current rule flow is concentrated in one high-risk file
- **Warning signs:** Small gameplay fixes keep breaking score summaries or bell timing; feature work repeatedly touches unrelated timer code
- **Prevention:** Extract and test the pure game engine before adding major product surfaces
- **Phase to address:** Early stabilization / foundation phase

## Pitfall 2: Tutorial Logic Diverges From Real Gameplay

- **Why it happens:** Teams often hand-author tutorial examples and explanation text separately from the live rules
- **Warning signs:** Tutorial says one thing, live rounds behave another way; bug fixes land in play mode but not in teaching examples
- **Prevention:** Use the same evaluation helpers for tutorial examples, quizzes, and gameplay feedback
- **Phase to address:** Tutorial phase

## Pitfall 3: Feedback Tells The User They Were Wrong, But Not Why

- **Why it happens:** Systems return success/failure flags without error categories or fruit-level reasoning
- **Warning signs:** Result copy stays generic; users cannot tell whether they counted the wrong fruit, missed an exact-five condition, or confused greater-than-five with equal-five
- **Prevention:** Expand engine outputs to include reason codes and highlighted evidence for each judgment
- **Phase to address:** Tutorial / feedback phase

## Pitfall 4: Mobile Is Treated As A Late CSS Pass

- **Why it happens:** The current MVP is already playable, so teams postpone interaction-zone redesign and only tweak layout breakpoints later
- **Warning signs:** Bell button is technically visible on mobile but awkward to hit; card information becomes crowded under active play
- **Prevention:** Treat touch reachability, button size, and central information hierarchy as product requirements, not cosmetic cleanup
- **Phase to address:** Responsive UX phase

## Pitfall 5: Local Storage Is Trusted Too Much

- **Why it happens:** Local-only products often assume stored values are always valid
- **Warning signs:** Returning users hit broken screens after settings schema changes; invalid values crash render-time lookups
- **Prevention:** Validate and clamp persisted data on load; safely ignore malformed records
- **Phase to address:** Foundation / persistence phase

## Pitfall 6: Scope Expands Into Social Features Before Solo Retention Is Proven

- **Why it happens:** Leaderboards, accounts, and challenges feel exciting and visible
- **Warning signs:** Roadmap phases start referencing auth, cloud sync, or multiplayer before tutorial and feedback quality are solid
- **Prevention:** Keep the roadmap anchored on the PRD's current validation target: low-friction single-player learning and repeat practice
- **Phase to address:** Roadmap shaping throughout the milestone

## Pitfall 7: Results Become Decorative Instead Of Actionable

- **Why it happens:** Teams add more stats without connecting them to improvement
- **Warning signs:** Result screen grows longer but does not tell users what to do next; players cannot connect misses and wrong hits to specific patterns
- **Prevention:** Favor a smaller set of high-signal metrics plus next-step cues, personal-best comparison, and obvious replay / tutorial actions
- **Phase to address:** Results and progress phase

## Pitfall 8: No Safety Net For Timer Races

- **Why it happens:** Reaction games depend on intervals, timeouts, and transient windows that can race during restart or finish transitions
- **Warning signs:** Final misses disappear, rapid restarts create inconsistent state, replay actions intermittently misbehave
- **Prevention:** Centralize round-state transitions, track startup/cleanup handles consistently, and add focused tests around finish/restart edges
- **Phase to address:** Foundation / stabilization phase

---
*Pitfalls research completed: 2026-04-06*
