# Halligalli Boss Practice

A browser-based Halligalli trainer with single-player practice and real-time multiplayer rooms. Features a tabletop-inspired layout, Boss mode with Yang, 3D card animations, and bilingual UI (zh/en).

**Live**: https://halligalli-8xko3.ondigitalocean.app/

## Features

### Single-player
- `3–6` player table layouts with clockwise flipping
- Top-card-only validation matching the tabletop rule
- Bell hit / miss / penalty logic with reaction-time scoring
- Boss Mode with Yang taunts and visual pressure
- Configurable difficulty and round length
- Local best / recent score persistence
- Animated end-of-round score breakdown

### Multiplayer
- Create a room, share a 4-character match code
- Up to 6 players, ready-up lobby, host controls
- Server-authoritative game loop — fair across all clients
- First-press-wins bell races
- Ranked per-player scoreboard at the end
- Same-origin socket.io, zero setup for players

### Polish
- 3D card flip, bell particle burst, screen transitions
- Homepage entrance animations, glow-sweep buttons
- 3-2-1 countdown before every round
- Full `prefers-reduced-motion` fallback
- Chinese / English language switch
- Sound effects (mobile audio-unlock included)

## Tech Stack

- React 19 + Vite 7 + plain CSS (frontend)
- Node.js + socket.io 4 (WebSocket server)
- Vitest for unit tests
- Single-service deploy on DigitalOcean App Platform

## Getting Started

### Dev (both frontend and server)

```bash
npm install
npm run dev         # Vite dev server on :5173
npm run dev:server  # socket.io server on :3001 (in a second terminal)
```

Vite proxies `/socket.io` to the server automatically. Open http://localhost:5173.

### Single-terminal dev (frontend only)

Multiplayer features will not work without the server, but single-player does:

```bash
npm run dev
```

### Tests

```bash
npm test
```

### Production build + run

```bash
npm install --include=dev
npm run build   # outputs dist/
npm start       # server serves dist/ + socket.io on port 3001
```

Open http://localhost:3001.

## Gameplay Notes

- Players flip cards clockwise.
- Only each player's top visible card counts.
- Ring only when one fruit totals exactly `5`.
- A correct ring collects all face-up table cards.
- A wrong ring applies a penalty based on half the table cards, rounded up.
- In Boss Mode, Yang taunts the player after missed bell windows.
- In multiplayer, the first valid bell press wins; others get the wrong-ring penalty. Missed bell windows penalize everyone.

## Project Structure

```text
src/
├── App.jsx              — UI + single-player game loop
├── main.jsx             — app entry
├── styles.css           — all styles
├── game/                — shared game logic (browser + server)
│   ├── constants.js
│   ├── persistence.js
│   ├── rules.js
│   └── lifecycle.js
└── multiplayer/
    └── socket.js        — socket.io-client singleton

server/
├── index.js             — HTTP server + socket.io router + static dist/ serving
├── Room.js              — room/player model, match codes, host transfer
└── GameEngine.js        — server-authoritative game loop

.do/app.yaml             — DigitalOcean App Platform spec
scripts/simulate-bell.mjs — card-distribution tuning utility
public/yang-boss.png     — Boss portrait
```

## Deployment

Deployed as a single Node service on DigitalOcean App Platform. The server serves the Vite-built static frontend from `dist/` and accepts WebSocket connections on the same origin — no CORS config, no separate CDN.

- Config: `.do/app.yaml`
- Trigger: `git push origin master` (auto-deploys)
- Manual: `doctl apps create-deployment <app-id>`

See `CLAUDE.md` → Deployment for full ops notes.

## License

Private project.
