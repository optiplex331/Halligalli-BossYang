# Contributing

Thanks for taking a look at Halligalli Arena. This project is intentionally small: React, Vite, TypeScript, plain CSS, Node.js, socket.io, and Vitest.

## Local Setup

```bash
pnpm install
pnpm run dev
pnpm run dev:server
```

Open http://localhost:5173.

## Checks

Run these before opening a pull request:

```bash
pnpm run test
pnpm run typecheck
pnpm run build
```

## Contribution Guidelines

- Keep gameplay rule changes covered by tests.
- Keep stable visible copy bilingual in `COPY.zh` and `COPY.en`.
- Do not add a router, state library, CSS framework, Express, or a database for normal gameplay changes.
- Multiplayer clients should emit intent only; scoring and match authority stay on the server.
- New `localStorage` keys need normalization and persistence tests.
- Preserve keyboard, screen-reader, mobile touch-target, and `prefers-reduced-motion` behavior.

## Good First Areas

- Accessibility review and keyboard-flow fixes.
- Mobile layout refinements.
- Additional pure tests for gameplay edge cases.
- Documentation improvements.
- Small visual polish that keeps the midnight table identity.

## Pull Request Shape

Keep pull requests focused. Include:

- What changed.
- Why it changed.
- Screenshots for visual changes.
- Checks run locally.
