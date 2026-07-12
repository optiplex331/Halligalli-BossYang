# Contributing

Halligalli is a small Product Monorepo with two application owners: React/Vite
Web and future FastAPI/Redis API. Keep changes within their owner and use the
root commands as the thin human-facing facade.

## Local setup

```bash
node --version       # >=24.0.0 <25
pnpm --version       # 11.x
pnpm install
pnpm run dev         # focused Web development on :5173
```

The API package is intentionally not runnable before the authenticated-room
entry slice. Do not add a placeholder HTTP or Socket.IO runtime to bridge that
gap.

## Checks

```bash
pnpm run test
pnpm run typecheck
pnpm run build
pnpm run check
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
