# External Integrations

**Analysis Date:** 2026-04-06

## APIs & External Services

**Third-party APIs:**
- None detected in the shipped app code.
  - Evidence: no `fetch`, `axios`, `XMLHttpRequest`, `WebSocket`, `EventSource`, or external SDK imports were found in `src/App.jsx`, `src/main.jsx`, `vite.config.js`, or `index.html`.

**Browser Platform Services:**
- `localStorage` - Used for persistent local-only game settings and score summaries in `src/App.jsx`.
  - SDK/Client: native browser API
  - Auth: Not applicable
- Web Audio API - Used to synthesize bell/feedback tones in `src/App.jsx` through `window.AudioContext` / `window.webkitAudioContext`.
  - SDK/Client: native browser API
  - Auth: Not applicable

## Data Storage

**Databases:**
- None.
  - Connection: Not applicable
  - Client: Not applicable

**File Storage:**
- Local static asset serving only.
  - `public/yang-boss.png` is copied into the build and referenced from `src/App.jsx`.
  - `dist/yang-boss.png` exists as generated build output.

**Caching:**
- Browser local persistence only via `window.localStorage` in `src/App.jsx`.

## Authentication & Identity

**Auth Provider:**
- None.
  - Implementation: The app has no login flow, no user accounts, and no identity provider hooks in `src/`.

## Monitoring & Observability

**Error Tracking:**
- None detected.

**Logs:**
- No logging framework or telemetry client is configured in `src/`, `package.json`, or `vite.config.js`.

## CI/CD & Deployment

**Hosting:**
- Not specified in the repository.
- The codebase is structured for static hosting because all runtime logic is front-end only (`src/main.jsx`, `src/App.jsx`) and the build emits static assets under `dist/`.

**CI Pipeline:**
- None detected in the repository root. No GitHub Actions, Vercel, Netlify, or other CI/CD config files were present in the analyzed paths.

## Environment Configuration

**Required env vars:**
- None detected.
- No `.env` files were found during analysis.
- No `import.meta.env` or `process.env` reads were found in `src/`, `index.html`, or `vite.config.js`.

**Secrets location:**
- Not applicable. The current app is local-only and does not appear to require secrets.

## Webhooks & Callbacks

**Incoming:**
- None.

**Outgoing:**
- None.

## Repo-Specific Integration Notes

- Use `window.localStorage` keys `halligalli_settings`, `halligalli_best`, and `halligalli_recent` from `src/App.jsx` when extending persistent client state. There is no abstraction layer or storage service module.
- Use static assets through `public/` and absolute paths like `/yang-boss.png`, matching the existing pattern in `src/App.jsx`.
- Treat `README.md` statements about "local score persistence" and "local-only progress" as accurate to the current code: persistence is browser-local only, with no sync path.
- Treat `docs/prd-web-halligalli.md` references to future login, cloud sync, leaderboard, and multiplayer features as roadmap items only. No corresponding integration code exists in `src/`.

---

*Integration audit: 2026-04-06*
