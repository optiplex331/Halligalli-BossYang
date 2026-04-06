# Requirements: Halligalli Web Practice

**Defined:** 2026-04-06
**Core Value:** A player should be able to open the site and get meaningful Halligalli practice immediately, with fast feedback that makes their next round better.

## v1 Requirements

### Home

- [ ] **HOME-01**: User can understand within a few seconds that the product is a Halligalli practice trainer from the home screen alone
- [ ] **HOME-02**: User can start a practice session from the home screen in one primary action
- [ ] **HOME-03**: User can open beginner teaching from the home screen before starting practice
- [ ] **HOME-04**: User can review recent and best local results from the home screen

### Tutorial

- [ ] **TUT-01**: User can complete a short step-by-step tutorial that explains the Halligalli core rule with static examples
- [ ] **TUT-02**: User can see dynamic tutorial examples that show when to ring and when not to ring
- [ ] **TUT-03**: User can complete a short tutorial quiz or comprehension check before entering practice
- [ ] **TUT-04**: User can skip tutorial and go straight to practice if they already know the game

### Practice Setup

- [ ] **SET-01**: User can configure difficulty before starting a round
- [ ] **SET-02**: User can configure speed or pace before starting a round
- [ ] **SET-03**: User can configure round length before starting a round
- [ ] **SET-04**: User can toggle sound and other core local preferences without breaking the session

### Practice Loop

- [ ] **PLAY-01**: User can play a single-player Halligalli round where the system reveals cards and continuously evaluates whether a valid bell condition exists
- [ ] **PLAY-02**: User can ring by a fixed, easy-to-reach control on mobile and by keyboard or click on desktop
- [ ] **PLAY-03**: User receives correct judgment when the ring is valid, invalid, or missed
- [ ] **PLAY-04**: User receives round feedback quickly enough that success or failure feels immediate during play
- [ ] **PLAY-05**: User can finish a round cleanly and transition to results without losing the final bell-state outcome

### Feedback And Results

- [ ] **FDBK-01**: User sees why a wrong ring was wrong, including at least the major error types described in the PRD
- [ ] **FDBK-02**: User sees when a bell opportunity was missed without the game becoming confusing or unreadable
- [ ] **RES-01**: User can review end-of-round stats including score, correct rings, wrong rings, missed rings, accuracy, average reaction time, and best reaction time
- [ ] **RES-02**: User can compare the current round against stored local best performance
- [ ] **RES-03**: User can immediately replay, adjust difficulty, review tutorial, or return home from the results screen

### Local Progress And Accessibility

- [ ] **DATA-01**: User's recent result, best result, and core settings persist locally between sessions
- [ ] **A11Y-01**: User can use the core play interaction with keyboard support and non-color-only feedback
- [ ] **RESP-01**: User can use the app on common desktop and mobile browser sizes without losing access to critical controls or key gameplay information

## v2 Requirements

### Extended Progress

- **PROG-01**: User can review multi-session improvement trends beyond only recent and best round summaries
- **PROG-02**: User can receive more personalized training recommendations based on mistake patterns

### Social And Account Features

- **ACCT-01**: User can sign in and sync history across devices
- **SOC-01**: User can view a leaderboard or daily challenge
- **SOC-02**: User can challenge friends or play against others online

### Advanced Training

- **ADV-01**: User can use adaptive difficulty or AI-assisted coaching
- **ADV-02**: User can choose additional input methods beyond click and keyboard

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time multiplayer | Not required to validate the solo training loop |
| Accounts and cloud sync | Local persistence is enough for v1 |
| Leaderboards and daily challenges | Deferred until the solo product is proven |
| Achievements meta-system | Secondary to teaching and feedback clarity |
| Licensed official card replication | Practice fidelity matters more than exact product replication |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| HOME-01 | Phase 2 | Pending |
| HOME-02 | Phase 2 | Pending |
| HOME-03 | Phase 2 | Pending |
| HOME-04 | Phase 4 | Pending |
| TUT-01 | Phase 3 | Pending |
| TUT-02 | Phase 3 | Pending |
| TUT-03 | Phase 3 | Pending |
| TUT-04 | Phase 3 | Pending |
| SET-01 | Phase 2 | Pending |
| SET-02 | Phase 2 | Pending |
| SET-03 | Phase 2 | Pending |
| SET-04 | Phase 2 | Pending |
| PLAY-01 | Phase 1 | Pending |
| PLAY-02 | Phase 2 | Pending |
| PLAY-03 | Phase 1 | Pending |
| PLAY-04 | Phase 1 | Pending |
| PLAY-05 | Phase 1 | Pending |
| FDBK-01 | Phase 3 | Pending |
| FDBK-02 | Phase 3 | Pending |
| RES-01 | Phase 4 | Pending |
| RES-02 | Phase 4 | Pending |
| RES-03 | Phase 4 | Pending |
| DATA-01 | Phase 1 | Pending |
| A11Y-01 | Phase 5 | Pending |
| RESP-01 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0

---
*Requirements defined: 2026-04-06*
*Last updated: 2026-04-06 after initial definition*
