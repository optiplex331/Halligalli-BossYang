# Requirements: Halligalli Web Practice

**Defined:** 2026-04-06
**Core Value:** A player should be able to open the site and get meaningful Halligalli practice immediately, with fast feedback that makes their next round better.

## v1 Requirements

### Tutorial

- [ ] **TUT-01**: User can enter a dedicated beginner tutorial from the home screen before starting a full practice round
- [ ] **TUT-02**: User can learn the exact Halligalli rule through guided examples that distinguish correct rings from incorrect rings
- [ ] **TUT-03**: User can complete a short tutorial check with immediate answer feedback before entering practice

### Practice Modes

- [ ] **PRA-01**: User can start a practice round with clearly labeled difficulty, speed, and duration options aligned to training goals
- [ ] **PRA-02**: User can use the same core rule engine across tutorial and live practice so rule behavior stays consistent
- [ ] **PRA-03**: User can complete a round with reliable hit, miss, and penalty handling even at round-end timing boundaries

### Feedback

- [ ] **FDB-01**: User receives feedback within the active play screen that clearly indicates whether a ring was correct, wrong, or missed
- [ ] **FDB-02**: User is told why a wrong ring was wrong, including at least the cases of no exact-five match, greater-than-five mistaken for five, or mixed-fruit counting
- [ ] **FDB-03**: User can see which fruit condition triggered a valid ring when the ring was correct

### Results

- [ ] **RES-01**: User can review a round summary that includes score, correct hits, wrong hits, missed hits, accuracy, average reaction time, and best reaction time
- [ ] **RES-02**: User can compare the current round against local best or recent performance in a way that suggests what to do next
- [ ] **RES-03**: User can restart practice, open tutorial, adjust settings, or return home directly from the results screen

### Persistence

- [ ] **PER-01**: User settings, recent result, and best result are stored locally with validation so malformed browser data does not break the app
- [ ] **PER-02**: User can see recent and best summary information from the home screen without starting a round

### Responsive UX

- [ ] **RUX-01**: User can complete the main practice flow on both desktop and mobile browsers with readable table state and an easy-to-reach bell action
- [ ] **RUX-02**: User can trigger the primary bell action by keyboard on desktop and by a clear touch target on mobile
- [ ] **RUX-03**: User receives non-color-only status cues for important feedback states

### Quality

- [ ] **QLT-01**: Core game-rule logic is covered by automated tests for visible totals, ring evaluation, penalties, and summary generation
- [ ] **QLT-02**: Critical edge cases such as unresolved final bell windows, restart timing, and invalid local storage payloads are verified before release

## v2 Requirements

### Competitive

- **CMP-01**: User can sign in and sync progress across devices
- **CMP-02**: User can view leaderboards or daily challenge rankings
- **CMP-03**: User can play against friends or real-time opponents

### Progression

- **PRG-01**: User can unlock achievements or long-term progression rewards
- **PRG-02**: User can receive adaptive coaching or AI-driven difficulty adjustment

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time multiplayer | Explicitly deferred until solo training quality is validated |
| Accounts and cloud sync | Adds infrastructure and friction beyond the current milestone |
| Daily challenge / leaderboard systems | Secondary to onboarding, correctness, and replay value |
| Large progression meta-system | Not required to prove the practice loop |
| Licensed card-set reproduction | Product value is training fidelity, not asset replication |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TUT-01 | Phase 2 | Pending |
| TUT-02 | Phase 2 | Pending |
| TUT-03 | Phase 2 | Pending |
| PRA-01 | Phase 3 | Pending |
| PRA-02 | Phase 1 | Pending |
| PRA-03 | Phase 1 | Pending |
| FDB-01 | Phase 3 | Pending |
| FDB-02 | Phase 3 | Pending |
| FDB-03 | Phase 3 | Pending |
| RES-01 | Phase 4 | Pending |
| RES-02 | Phase 4 | Pending |
| RES-03 | Phase 4 | Pending |
| PER-01 | Phase 1 | Pending |
| PER-02 | Phase 4 | Pending |
| RUX-01 | Phase 4 | Pending |
| RUX-02 | Phase 4 | Pending |
| RUX-03 | Phase 4 | Pending |
| QLT-01 | Phase 1 | Pending |
| QLT-02 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-06*
*Last updated: 2026-04-06 after initial definition*
