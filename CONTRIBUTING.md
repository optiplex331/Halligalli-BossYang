# Contributing

Thanks for taking a look at Halligalli Arena. This project is intentionally small: React, Vite, TypeScript, plain CSS, Node.js, socket.io, and Vitest.

## Local Setup

```bash
node --version       # >=24.0.0 <25
pnpm --version       # >=11.0.9
pnpm install
pnpm run dev         # Vite on :5173
pnpm run dev:server  # socket.io server on :3001, in a second terminal
```

Open http://localhost:5173. Local multiplayer should still use the Vite origin; `vite.config.ts` proxies `/socket.io` to the server on `:3001`.

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
- Multiplayer room settings and docs should stay aligned with the supported 3-6 player layouts; the server rejects 2-player starts even if a lobby exists.
- New `localStorage` keys need normalization and persistence tests.
- Preserve keyboard, screen-reader, mobile touch-target, and `prefers-reduced-motion` behavior.
- Keep `docs/operations/kubernetes.md` aligned when changing the standalone container or production-facing runtime contract.
- Do not put production-used Helm chart templates, real Azure Kubernetes Desired State, Terraform roots, cloud credentials, kubeconfigs, rendered live manifests, or generated infrastructure files in this repo; those belong in the infrastructure repo.

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
