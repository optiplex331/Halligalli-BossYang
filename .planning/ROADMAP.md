# Roadmap: Halligalli Web Practice

**Created:** 2026-04-06
**Mode:** YOLO
**Granularity:** Standard

## Overview

This roadmap covers the next productizing milestone for the existing Halligalli trainer. The current playable MVP remains the baseline; these phases focus on making the experience teachable, trustworthy, and usable across desktop and mobile.

## Phase Summary

| # | Phase | Goal | Requirements |
|---|-------|------|--------------|
| 1 | Foundation And Game Integrity | Extract and stabilize the rule engine, persistence, and timing behavior so new product features rest on trustworthy logic | PRA-02, PRA-03, PER-01, QLT-01, QLT-02 |
| 2 | Tutorial And First-Time Onboarding | Add a dedicated learning path that teaches the exact-five rule and prepares new users for a first real round | TUT-01, TUT-02, TUT-03 |
| 3 | Practice Flow And Explainable Feedback | Upgrade the live practice experience with clearer training controls and explicit in-round feedback | PRA-01, FDB-01, FDB-02, FDB-03 |
| 4 | Results, Progress, And Responsive Product Polish | Turn the app into a more complete web product with stronger result actions, progress framing, and mobile-friendly usability | RES-01, RES-02, RES-03, PER-02, RUX-01, RUX-02, RUX-03 |

## Phase Details

### Phase 1: Foundation And Game Integrity

**Goal:** Make the existing game loop safe to extend by pulling core rule logic out of the monolith, validating persistence, and closing timing edge cases.

**Requirements:** PRA-02, PRA-03, PER-01, QLT-01, QLT-02

**Success Criteria:**
1. Core Halligalli rule evaluation and summary generation run through extracted, test-covered logic outside the main UI component
2. Invalid local storage data no longer crashes the app and falls back to safe defaults
3. End-of-round unresolved bell windows and restart timing paths behave consistently under manual verification and automated tests
4. The app still builds and preserves the current playable loop after the refactor

**UI hint:** no

### Phase 2: Tutorial And First-Time Onboarding

**Goal:** Give new users a dedicated path to understand the exact-five same-fruit rule before jumping into a full session.

**Requirements:** TUT-01, TUT-02, TUT-03

**Success Criteria:**
1. The home screen exposes a clear tutorial entry alongside the fast path into play
2. Tutorial content demonstrates both correct and incorrect ringing scenarios using the same rule logic as live gameplay
3. A short tutorial check provides immediate feedback and leads naturally into practice
4. Tutorial copy works in both supported languages

**UI hint:** yes

### Phase 3: Practice Flow And Explainable Feedback

**Goal:** Make active training more legible by clarifying mode controls and telling the user exactly what happened after each bell event.

**Requirements:** PRA-01, FDB-01, FDB-02, FDB-03

**Success Criteria:**
1. Practice setup presents difficulty, speed, and duration as understandable training choices
2. Correct, wrong, and missed events produce visibly distinct feedback during play
3. Wrong rings explain the mistake category instead of only reporting failure
4. Correct rings identify the matching fruit condition so users can reinforce the right pattern

**UI hint:** yes

### Phase 4: Results, Progress, And Responsive Product Polish

**Goal:** Close the loop with actionable results, persistent progress cues, and a cleaner desktop/mobile experience.

**Requirements:** RES-01, RES-02, RES-03, PER-02, RUX-01, RUX-02, RUX-03

**Success Criteria:**
1. The results screen presents the full PRD-aligned summary metrics and obvious next actions
2. Home and results surfaces show recent and best local performance in a useful, low-noise way
3. The play flow remains readable and easy to operate on common mobile and desktop layouts
4. Feedback states are understandable without relying only on color

**UI hint:** yes

## Coverage Check

- v1 requirements: 19
- Requirements mapped: 19
- Unmapped requirements: 0
- Roadmap status: Ready for phase planning

---
*Roadmap created: 2026-04-06*
