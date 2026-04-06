# Phase 1 Plan 01 Summary

## Objective

Establish the extracted game-logic foundation and the repo's first automated regression harness.

## Completed

- Added `vitest` and a stable `npm test` command in `package.json`
- Extracted deterministic gameplay helpers into `src/game/rules.js`
- Centralized shared constants in `src/game/constants.js`
- Updated `src/App.jsx` to consume extracted rule helpers instead of keeping those behaviors entirely inline
- Added regression coverage for visible totals, bell availability, penalty handling, collection behavior, summary generation, and final-bell reconciliation

## Verification

- `npm test`
- `npm run build`

## Outputs

- `src/game/constants.js`
- `src/game/rules.js`
- `src/__tests__/rules.test.js`
- `package.json`

---
*Completed: 2026-04-06*
