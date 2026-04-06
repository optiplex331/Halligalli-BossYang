# Halligalli Web Practice

## What This Is

Halligalli Web Practice is a browser-based Halligalli training app for players who want to learn the rules, sharpen recognition, and improve bell timing without needing a physical deck or multiple people in the room. The current app already delivers a local single-player practice experience with tabletop-inspired card flow, configurable difficulty, Boss mode pressure, bilingual copy, and local score persistence. The next project goal is to evolve that foundation toward the PRD's broader product shape: clearer onboarding, more structured training, and stronger feedback on accuracy, mistakes, and progress.

## Core Value

A player should be able to open the site and get meaningful Halligalli practice immediately, with fast feedback that makes their next round better.

## Requirements

### Validated

- ✓ User can start a local single-player Halligalli practice round from the browser home screen — existing
- ✓ User can configure round basics including player count, duration, difficulty, language, and sound before play — existing
- ✓ User can practice the core Halligalli rule using clockwise flips and top-card-only counting — existing
- ✓ User can ring by click or keyboard and receive immediate success, miss, or penalty feedback — existing
- ✓ User can complete a round and review score, accuracy, reaction-time, and round summary metrics — existing
- ✓ User can see recent and best local results stored in browser local storage — existing
- ✓ User can switch between Chinese and English interface copy — existing
- ✓ User can play a higher-pressure Boss mode with Yang taunts layered onto missed opportunities — existing

### Active

- [ ] User can understand the Halligalli core rule and start a first useful session within three minutes
- [ ] User can complete a guided beginner tutorial with static examples, dynamic examples, and a short comprehension check
- [ ] User can choose focused training modes and settings that match skill level, speed, and session length goals
- [ ] User can receive clearer explanations for wrong rings and missed rings, including why the judgment was wrong
- [ ] User can review richer post-round feedback including mistake categories, progress cues, and comparison against personal bests
- [ ] User can use the trainer comfortably on both desktop and mobile browsers as a polished web product, not just a functional prototype

### Out of Scope

- Real-time multiplayer or friend battles — explicitly deferred in the PRD until the single-player training loop is proven
- User accounts and cloud sync — local-only progress is sufficient for the current milestone and keeps scope low
- Leaderboards and daily challenges — useful later, but not required to validate the core training experience
- Achievements and progression meta-systems — secondary to teaching the rule and improving reaction accuracy
- AI coaching or adaptive difficulty — mentioned as future direction, but not needed for the first productized version
- Official commercial card-set replication — current goal is practice fidelity, not licensed asset reproduction

## Context

This repository is a brownfield Vite + React application with all runtime logic currently concentrated in `src/App.jsx` and shared styling in `src/styles.css`. The app already simulates a Halligalli-style table with 3-6 seats, clockwise reveal flow, correct-hit / miss / penalty logic, a results screen, and browser-local persistence for settings and score summaries. Product direction is documented in `docs/prd-web-halligalli.md`, which expands the vision from a lightweight boss-practice MVP into a broader web training product centered on rule learning, single-player drills, and data feedback.

The strongest existing behavior is the playable local practice loop. The largest gaps against the PRD are onboarding, explicit tutorial flow, structured training modes, more instructive error feedback, and a more complete progress story. The current implementation is already web-only, local-first, and frontend-only, which keeps iteration fast and matches the current validation goal.

## Constraints

- **Tech stack**: React 19 + Vite 7 + plain CSS — preserve the existing frontend stack to keep momentum in the current codebase
- **Architecture**: Single-page client-only app with browser local storage — there is no backend, auth, or cloud persistence to lean on
- **Product scope**: Single-player training first — the PRD explicitly prioritizes practice quality before social or competitive features
- **Platform**: Desktop and mobile browsers — the next iteration must feel intentional on both form factors
- **Content**: Bilingual UI support already exists — new flows should not regress Chinese / English parity
- **Codebase shape**: Most logic lives in one large component today — feature work should account for current coupling and likely need incremental decomposition

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build on the existing app instead of restarting | The repo already proves the core single-player loop and contains working Halligalli simulation logic | ✓ Good |
| Keep the project web-first and backend-free for now | The main validation target is low-friction practice, not account systems or multiplayer infrastructure | ✓ Good |
| Treat tutorial and feedback clarity as first-class product work | The PRD's success metrics depend on comprehension, first-session completion, and visible improvement | — Pending |
| Preserve local persistence as the source of truth for v1 progress | Recent and best results already exist locally, and cloud sync is deferred | — Pending |
| Maintain bilingual support across future features | The current product already serves Chinese and English users, so new UX work should not narrow audience reach | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-06 after initialization*
