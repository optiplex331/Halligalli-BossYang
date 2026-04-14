# Halligalli Boss Practice

A browser-based Halligalli trainer built to feel as close to the physical card game as possible. Players sit around a virtual felt table, flip cards clockwise, and race to ring the bell the moment any fruit totals exactly five. Available in single-player practice mode and real-time multiplayer rooms.

**Live**: https://halligalli-8xko3.ondigitalocean.app/

---

## Game Mechanics

### The core rule
Cards are flipped one at a time, clockwise around the table. Each player's pile is face-up, but **only the top card counts** — older cards beneath it are invisible to the rule engine, just as in the physical game. The moment any single fruit across all top cards totals exactly 5, the bell window opens.

### Bell timing
Ringing the bell is not binary. A **speed bonus window** rewards faster reactions — the sooner you hit the bell after the window opens, the more bonus points you earn. Miss the window entirely and every player takes a −30 penalty on the next flip.

### Scoring formula
| Event | Points |
|---|---|
| Correct ring — base | +120 |
| Collected cards | +6 per card |
| Speed bonus | up to +~50 (scales with reaction time) |
| Consecutive streak | +10 per hit in current streak |
| Wrong ring | −50 |
| Penalty cards paid | −4 per card |
| Missed bell window | −30 (applied to all players in multiplayer) |

### Wrong ring penalty
Pressing the bell when no fruit totals five triggers a penalty: the player forfeits half the cards on the table (rounded up), shuffled to the bottom of their own pile. No cards to forfeit means no deduction, but the −50 still applies.

### Difficulty
Three modes vary the flip interval and speed-bonus window:

| Mode | Flip speed | Speed-bonus window |
|---|---|---|
| Easy | ~1.85 s | generous |
| Normal | ~1.1 s | standard |
| Boss | ~900 ms | tight |

### Card deck
The deck uses an optimized distribution (`COUNT_DISTRIBUTION`) tuned via Monte Carlo simulation to target 4–7 card flips between bell windows across 3–6 player counts. 2-pip and 3-pip cards are most common; 5-pip cards are rare, preventing trivially obvious single-card rings.

### Multiplayer rules
In a multiplayer room the server runs the authoritative game loop — no client can fake a win. Bell presses are first-come-first-served: the first valid press collects the table; all other simultaneous presses receive the wrong-ring penalty. A missed bell window penalises every player equally.

---

## Design Features

### Tabletop spatial layout
Players are rendered as seats around an oval felt table, positioned using the same clockwise ordering as the physical game. The acting player is highlighted each flip so the user always knows whose turn it is without counting.

### 3D card flip animation
Cards use CSS `rotateY` + `backface-visibility` to produce a genuine 3D flip. The back face is visible mid-rotation; the front snaps in at the end. Flip direction is consistent with the clockwise rule.

### Boss Mode — Yang
Yang is a persistent observer who appears in Boss difficulty. After any missed bell window he delivers a taunt — a brief message rendered with a float animation above his portrait. The table also shifts to signal pressure. All animations are gated by `prefers-reduced-motion`.

### Training progression (M4)
The home screen training card tracks long-term improvement across three tabs:

- **近期 / Recent** — last 5 rounds with score, accuracy, and avg reaction time
- **趋势 / Trend** — SVG line chart for accuracy (%) and reaction time (ms) over the past 14 days; unlocks after 3 days of data
- **成就 / Achievements** — 5 unlockable milestones (first round, 5-hit streak, perfect round, sub-200 ms reaction, 3-day daily goal streak)

A **daily goal** bar (5 rounds / day) resets each calendar day and feeds the streak achievement. All data lives in `localStorage` — no account required.

### Visual style
Dark felt palette, gold accent (`--gold-light`), tabular-numeral stat displays, and a glow-sweep button effect. The UI is fully bilingual (Chinese / English) and switches without reload. Every interactive element meets WCAG 2.5.5 minimum touch target size on mobile.

---

## Features Summary

### Single-player
- 3–6 player table layouts with clockwise flipping
- Top-card-only bell validation matching the physical game rule
- Speed bonus, streak multiplier, and penalty logic
- Boss Mode with Yang taunts and visual pressure
- Configurable difficulty and round length
- Animated end-of-round score breakdown

### Multiplayer
- Create a room, share a 4-character match code
- Up to 6 players, ready-up lobby, host controls
- Server-authoritative game loop — fair across all clients
- First-press-wins bell races with simultaneous-press penalty
- Ranked per-player scoreboard at the end
- Same-origin socket.io, zero setup for players

### Training log
- Last 5 rounds on the home screen (score, accuracy, avg reaction, mode badge)
- Rolling 100-round history in `localStorage` (`halligalli_history`)
- 14-day SVG trend charts for accuracy and reaction time
- Daily goal tracker with cross-day reset
- 5 achievements with unlock timestamps and toast notifications

### Polish
- 3D card flip, bell particle burst, screen transitions
- Homepage entrance animations, glow-sweep buttons
- 3-2-1 countdown before every round
- Full `prefers-reduced-motion` fallback (all keyframes covered)
- Chinese / English language switch
- Sound effects with iOS audio-unlock on every game-entry button
- Screen-reader accessible: `aria-live` on feedback/penalty/boss taunt, `aria-label`/`aria-pressed` on bell, `role="dialog"` on lobby, screen-change focus management
- WCAG 2.5.5 touch targets (44 px min-height on all interactive elements at mobile breakpoint)

---

## Tech Stack

- React 19 + Vite 7 + plain CSS (frontend)
- Node.js + socket.io 4 (WebSocket server)
- Vitest for unit tests (40 tests across game logic, persistence, and stats)
- Single-service deploy on DigitalOcean App Platform

---

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

---

## Project Structure

```text
src/
├── App.jsx              — UI + single-player game loop
├── main.jsx             — app entry
├── styles.css           — all styles
├── audio/
│   └── useAudioEngine.js   — AudioContext hook (playFeedback, ensureUnlocked)
├── game/                — shared game logic (browser + server)
│   ├── constants.js
│   ├── persistence.js   — localStorage helpers incl. history, daily goal, achievements
│   ├── rules.js
│   ├── lifecycle.js
│   └── stats.js         — pure stat functions (streak, trend, daily goal streak)
└── multiplayer/
    ├── socket.js        — socket.io-client singleton
    └── useMultiplayerSocket.js — room/game socket event subscriptions

server/
├── index.js             — HTTP server + socket.io router + static dist/ serving
├── Room.js              — room/player model, match codes, host transfer
└── GameEngine.js        — server-authoritative game loop

.do/app.yaml             — DigitalOcean App Platform spec
scripts/simulate-bell.mjs — card-distribution tuning utility
public/yang-boss.png     — Boss portrait
```

---

## Deployment

Deployed as a single Node service on DigitalOcean App Platform. The server serves the Vite-built static frontend from `dist/` and accepts WebSocket connections on the same origin — no CORS config, no separate CDN.

- Config: `.do/app.yaml`
- Trigger: `git push origin master` (auto-deploys)
- Manual: `doctl apps create-deployment <app-id>`

See `CLAUDE.md` → Deployment for full ops notes.

---

## License

Private project.
