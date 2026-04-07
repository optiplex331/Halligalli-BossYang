---
status: testing
phase: 01-foundation-and-game-integrity
source:
  - 01-01-SUMMARY.md
  - 01-02-SUMMARY.md
  - 01-03-SUMMARY.md
started: 2026-04-06T19:49:28Z
updated: 2026-04-06T19:49:28Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: Cold Start Smoke Test
expected: |
  From a clean start, the app should boot without errors and render the home screen normally. If you run the dev server fresh and open the app, you should see the landing screen with the Halligalli practice UI rather than a crash, blank page, or error overlay.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: From a clean start, the app should boot without errors and render the home screen normally. If you run the dev server fresh and open the app, you should see the landing screen with the Halligalli practice UI rather than a crash, blank page, or error overlay.
result: pending

### 2. Invalid Persisted Settings Recovery
expected: If browser local storage contains invalid settings or malformed saved summaries, the app should still load and fall back to safe defaults instead of crashing or rendering broken controls.
result: pending

### 3. Round End Final Bell Integrity
expected: If a valid exact-five bell window exists right as the timer expires and you do not ring, the finished round should count that as a missed opportunity in the result data rather than silently dropping it.
result: pending

### 4. Restart And Replay Stability
expected: Starting a round, ending it, and immediately starting another round should behave cleanly without leftover timer behavior, duplicate flips, or stale feedback leaking from the previous round.
result: pending

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0

## Gaps

None yet
