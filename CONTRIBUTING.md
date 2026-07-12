# Contributing

Halligalli is a small Product Monorepo with two application owners: React/Vite
Web and FastAPI/Redis API. Keep changes within their owner and use the
root commands as the thin human-facing facade.

## Local setup

```bash
node --version       # >=24.0.0 <25
pnpm --version       # 11.x
pnpm install
pnpm run dev         # Web, API, and Redis; Web is exposed on :5173
```

Compose is the ordinary paired-runtime path. It exposes only Web; Vite keeps
`/api/v1` and `/ws/v1` same-origin through its internal API proxy. Use
`pnpm run dev:web` or `pnpm run dev:api` only for focused host-process work,
and stop Compose with `pnpm run dev:down`. Do not add a placeholder HTTP or
Socket.IO runtime as a fallback.

## Checks

```bash
pnpm run test
pnpm run typecheck
pnpm run build
pnpm run check
pnpm run test:e2e    # after pnpm run dev
pnpm run images:build
```

## Contribution rules

- Keep browser-local single-player rules in `apps/web/src/game/` and browser
  storage normalization in `apps/web/src/game/persistence.ts`.
- Keep stable visible copy bilingual in `COPY.zh` and `COPY.en`.
- Preserve keyboard, screen-reader, mobile 44 px target, document-language,
  and `prefers-reduced-motion` behavior.
- `contracts/` contains JSON data, schemas, and snapshots only—never imported
  executable TypeScript or Python source.
- The only retained Halligalli local-storage record is normalized
  `halligalli_settings`; do not add progress or identity storage.
- API transport and Multiplayer Authority code belongs to `apps/api`; it must
  never import Web source or browser APIs.
- Do not add a router, state library, CSS framework, Node compatibility server,
  database, or speculative monorepo runner.
- Production Helm, GitOps desired state, Terraform, secrets, kubeconfigs, and
  cloud operations remain outside this repository.

Keep pull requests focused and include the user-visible change plus commands
run locally.
