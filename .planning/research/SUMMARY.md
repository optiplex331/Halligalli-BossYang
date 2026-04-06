# Research Summary

**Research Date:** 2026-04-06

## Stack

Stay on React 19 + Vite 7 + plain CSS. The next milestone does not need a framework migration; it needs a safer game engine boundary, validated local persistence, and a lightweight test harness.

## Table Stakes

- Fast entry into a playable round
- Correct Halligalli evaluation for hit / miss / penalty
- Beginner onboarding that teaches the exact-five same-fruit rule
- Clear results and local progress recall
- Responsive desktop and mobile interaction

## Recommended Product Focus

1. Stabilize and extract the rule engine
2. Add tutorial and explanatory feedback on top of that shared logic
3. Upgrade results and progress framing
4. Polish responsive interaction and accessibility

## Watch Out For

- Adding more features directly inside `src/App.jsx`
- Tutorial rules drifting from gameplay rules
- Shipping generic failure feedback instead of explainable mistakes
- Treating mobile support as a final CSS-only sweep
- Trusting malformed local storage data

## Deliberately Deferred

- Multiplayer
- Accounts / cloud sync
- Leaderboards
- Heavy meta-progression systems
- Backend infrastructure

---
*Research summary completed: 2026-04-06*
