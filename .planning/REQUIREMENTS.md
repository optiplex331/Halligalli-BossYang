# Requirements: Halligalli Web Practice

**Defined:** 2026-04-06
**Core Value:** A player should be able to open the site and get meaningful Halligalli practice immediately, with fast feedback that makes their next round better.

## v1 Requirements

### Tutorial

- [ ] **TUT-01**: User can open a beginner tutorial from the home screen before starting practice
- [ ] **TUT-02**: User can learn the exact core rule through step-by-step examples that distinguish valid rings from invalid rings
- [ ] **TUT-03**: User can complete a short tutorial check and either pass it or skip into practice

### Practice

- [ ] **PRAC-01**: User can start a single-player practice round from the home screen in one primary action
- [ ] **PRAC-02**: User can configure difficulty, pace, round length, sound, and language before starting a round
- [ ] **PRAC-03**: User can trigger the bell by tap/click and by keyboard on desktop during practice
- [ ] **PRAC-04**: User can play through a Halligalli round where correct rings, wrong rings, and missed rings are judged according to the current visible table state

### Feedback

- [ ] **FDBK-01**: User receives perceptible feedback within the round after a correct ring, wrong ring, or missed ring
- [ ] **FDBK-02**: User can see which fruit or rule condition caused a correct ring to be valid
- [ ] **FDBK-03**: User can see why a wrong ring was wrong, including cases where no fruit equaled 5, a total greater than 5 was mistaken for 5, or mixed fruits were counted together
- [ ] **FDBK-04**: User can see reaction-time feedback for successful rings

### Results

- [ ] **RSLT-01**: User can review a round summary showing score, correct hits, wrong hits, missed hits, accuracy, average reaction time, and best reaction time
- [ ] **RSLT-02**: User can compare the latest round against at least one locally stored prior benchmark such as recent or best result
- [ ] **RSLT-03**: User can immediately replay, adjust difficulty, review tutorial, or return home from the result screen

### Persistence

- [ ] **PERS-01**: User can have common settings, recent result, and best result saved locally without creating an account
- [ ] **PERS-02**: User can still use the app safely when local persisted data is malformed or unavailable

### Responsive and Accessible UX

- [ ] **UX-01**: User can use the core practice flow on desktop and mobile browsers with a consistently reachable bell control
- [ ] **UX-02**: User can read the active table state and feedback clearly during live play on common screen sizes
- [ ] **UX-03**: User can understand success and failure states through more than color alone, with text or icon reinforcement

## v2 Requirements

### Progression

- **PROG-01**: User can access focused drills tailored to specific weaknesses or training goals
- **PROG-02**: User can see simple progress trends over multiple local sessions

### Social and Competitive

- **SOCL-01**: User can sign in and sync history across devices
- **SOCL-02**: User can compare results on a leaderboard or challenge board
- **SOCL-03**: User can join friend battles or multiplayer practice

### Advanced Coaching

- **COACH-01**: User can receive adaptive difficulty or AI-assisted coaching suggestions

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time multiplayer gameplay | Explicitly deferred until the single-player training loop is validated |
| Login-required onboarding | Conflicts with the low-friction "open and practice" core value |
| Cloud sync for v1 | Adds backend and identity scope before local retention value is proven |
| Leaderboards and daily challenges | Secondary to tutorial quality, trustworthy judgments, and repeat solo practice |
| Achievements, currencies, or unlock trees | Adds meta-systems without improving first-session learning quality |
| Official deck-brand reproduction | Practice fidelity matters more than asset replication for the current milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TUT-01 | TBD | Pending |
| TUT-02 | TBD | Pending |
| TUT-03 | TBD | Pending |
| PRAC-01 | TBD | Pending |
| PRAC-02 | TBD | Pending |
| PRAC-03 | TBD | Pending |
| PRAC-04 | TBD | Pending |
| FDBK-01 | TBD | Pending |
| FDBK-02 | TBD | Pending |
| FDBK-03 | TBD | Pending |
| FDBK-04 | TBD | Pending |
| RSLT-01 | TBD | Pending |
| RSLT-02 | TBD | Pending |
| RSLT-03 | TBD | Pending |
| PERS-01 | TBD | Pending |
| PERS-02 | TBD | Pending |
| UX-01 | TBD | Pending |
| UX-02 | TBD | Pending |
| UX-03 | TBD | Pending |

**Coverage:**
- v1 requirements: 19 total
- Mapped to phases: 0
- Unmapped: 19 ⚠️

---
*Requirements defined: 2026-04-06*
*Last updated: 2026-04-06 after initial definition*
