---
phase: 1
slug: foundation-and-game-integrity
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.js` or Vite-native config if added in Wave 0 |
| **Quick run command** | `npx vitest run src/**/*.test.*` |
| **Full suite command** | `npx vitest run && npm run build` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/**/*.test.*`
- **After every plan wave:** Run `npx vitest run && npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | PRA-02 | — | Shared rule helpers return deterministic totals, ring, penalty, and summary results | unit | `npx vitest run src/**/*.test.*` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | QLT-01 | — | Test harness runs in CI-like non-watch mode and covers extracted rule modules | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 2 | PER-01 | T-1-01 | Invalid persisted data is normalized or discarded before rendering | unit | `npx vitest run src/**/*.test.*` | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 2 | QLT-02 | T-1-02 | Storage write failures do not crash the session | unit | `npx vitest run src/**/*.test.*` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 3 | PRA-03 | T-1-03 | Final bell windows and restart timing paths reconcile predictably | unit | `npx vitest run src/**/*.test.*` | ❌ W0 | ⬜ pending |
| 1-03-02 | 03 | 3 | QLT-02 | — | Full suite and production build both pass after integrity fixes | build | `npx vitest run && npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/**/*.test.*` — initial rule and persistence regression specs
- [ ] `vitest` dependency and runnable npm command — first automated verification path for the repo
- [ ] `vitest.config.js` or equivalent Vite-native setup — stable non-watch test execution

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Current playable loop still feels intact after extraction | PRA-03 | Core cadence and gameplay feel are best confirmed by a short manual round | Run `npm run dev`, start a round, verify ring, miss, and result flow still match the pre-phase behavior aside from fixed integrity bugs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
