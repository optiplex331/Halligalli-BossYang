<p align="center">
  <img src="apps/web/public/icon.svg" width="96" height="96" alt="Halligalli Arena icon" />
</p>

# Halligalli Arena

Halligalli Arena is a bilingual exact-five card-reaction game. The current
product slice delivers the browser-local Single-Player Path plus a FastAPI/Redis
authoritative multiplayer match on four through eight Table Seats.

[Play the live demo](https://play.halligalli.games)

It is a Product Monorepo with two application owners. The Web application keeps
all active round state in memory and preserves only normalized presentation
preferences in browser storage. The API owns ephemeral Redis room state and
Room Configuration, Seat Occupancy, ready/start/turn/bell/result path, shared
scoring ledger, and stable Seat Indexes.

## DevOps

The project publishes paired Web/API releases and promotes them independently
to Container Apps, AKS, or K3s. See [DEVOPS.md](DEVOPS.md) for the two-minute
architecture and delivery overview.

## Local development

```bash
node --version       # v24.x
pnpm --version       # 11.0.9
pnpm install
pnpm run dev         # Web, API, Redis; open http://localhost:5173
```

Compose exposes only the Web on `http://localhost:5173`. Vite proxies `/api/v1`
and `/ws/v1` to the internal API, so browser traffic remains same-origin. Room
state belongs only to the disposable Redis container; Compose commits neither
credentials nor a data volume.

For focused host-process work, run `pnpm run dev:web` or set
`HALLIGALLI_REDIS_URL=redis://localhost:6379/0` and run `pnpm run dev:api`.
Stop the local stack with `pnpm run dev:down`.

## Checks

```bash
HALLIGALLI_TEST_REDIS_URL=redis://localhost:6379/0 pnpm run test  # with an isolated Redis running
pnpm run typecheck
pnpm run build
HALLIGALLI_TEST_REDIS_URL=redis://localhost:6379/0 pnpm run check
pnpm --dir apps/web run test:layout  # real-Chrome responsive game-flow checks
pnpm run test:e2e    # after pnpm run dev; one sequential-room Paired Runtime journey
```

## Current game behavior

- 72-card Halligalli inventory: banana, strawberry, lemon, and grape.
- The Single-Player Path uses four through eight Table Seats, exactly one Human
  Participant, and automatic Neutral Seats with clockwise flips.
- Responsive ring and grid layouts keep every Table Seat card fully visible
  without card or Bell overlap from the 320 px mobile boundary upward.
- Multiplayer Room Configuration independently selects four through eight Table
  Seats and two through the selected seat count Human Participants. Neutral
  Seats reveal and affect Bell totals but never ring or score.
- Multiplayer difficulty sets the reveal pace. A match ends when the shuffled
  deck is exhausted or fewer than two Human Participants remain, so a leaver
  forfeits instead of stalling the table. Turn and post-match deadlines live in
  Redis and survive an API restart; the multiplayer `durationSec` input is
  deprecated and ignored.
- Ring only when one fruit totals exactly five; a correct ring collects the
  table, while a wrong ring pays ceiling-half of the table cards.
- Easy, Normal, and Boss difficulties; 45/60/90-second rounds; button and
  Space-bar bell input.
- Chinese and English copy, document language updates, live announcements,
  keyboard focus, 44 px mobile controls, and reduced-motion coverage.
- Per-transition score floor and score-breakdown ledger, so absorbed penalties
  never become hidden debt.

## Storage and privacy

`halligalli_settings` is the only Halligalli browser key retained by this
product slice. It stores normalized language, sound, difficulty, duration, and
Table Seat count preferences. Historical best/recent results, history, trends,
daily goals, and achievements are removed on load and are never written again.

There are no accounts, payments, durable match records, player profiles, or
room recovery. The Multiplayer Authority uses ephemeral Redis state.

## Client bounds

The API keys client limits on the client address resolved through exactly the
number of proxies that each deployment target places in front of it, set by
`HALLIGALLI_TRUSTED_PROXY_HOPS`. Every trusted proxy appends its own peer to
`X-Forwarded-For`, so the entry that many places from the right is the client;
entries further left were written by the client and are ignored. The default
`0` trusts no header and uses the TCP peer, which is correct for Compose, where
the Vite proxy adds no forwarded header. Each deployment target sets its count
in the Infrastructure repository: Container Apps trusts three hops (Cloudflare,
the platform ingress, and the Web nginx, with the ingress admitting only
Cloudflare), K3s two (Cloudflare Tunnel and the Web nginx), and AKS one (the
NGINX Ingress controller). The release image disables uvicorn's
own forwarded-header handling so this is the only trust decision.

Room creation spends one unit of a per-address budget of 480 rooms per hour,
stored as an expiring Redis counter; the 481st creation in the window returns
`429 room_creation_limited`. The budget is pre-registered to cover one load
generator at the simulated traffic peak: 15 concurrent rooms for the whole
20-minute run, each replaced after the shortest possible match (72 reveals at
the hard pace of 550 ms, about 40 s), gives 15 × 1200 s / 40 s ≈ 455
creations, rounded up to 480 for retries. Rematches continue in the same room,
so they spend no budget; the bound still holds if every rematch were a new room.

WebSocket messages larger than 4096 bytes close the socket with code 1009. The
release image sets `UVICORN_WS_MAX_SIZE` to the same bound so oversized frames
are refused before they are buffered.

## Project shape

```text
apps/
├── web/                    # React/Vite Single-Player Path
└── api/                    # FastAPI REST/WebSocket + Redis authority
contracts/
├── fixtures/               # Versioned language-neutral behavior data
└── openapi.json            # Pydantic-generated REST contract snapshot
tests/
└── e2e/                    # Cross-Web/API Compose journey
compose.yaml                # Web + API + Redis local development stack
```

`contracts/` is data only. The TypeScript browser rules and Python authority
consume the same JSON fixtures independently; they never share an executable
rules package.

The Web image installs its build dependencies, including React and ReactDOM,
before Vite produces `dist/`. Its nginx runtime contains only that generated
static output, so these browser-bundle packages are development dependencies
rather than Node.js runtime dependencies.
