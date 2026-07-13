# Shared Behavior Contract

`contracts/` contains language-neutral data only: versioned JSON fixtures,
schemas, and generated contract snapshots. It is not a package and contains no
runtime source code.

`openapi.json` is generated from FastAPI Pydantic transport models. The Web
uses the generated `apps/web/src/multiplayer/rest.generated.ts` types rather
than keeping a second REST schema. Regenerate both with `pnpm run
contracts:openapi` and `pnpm run contracts:types`.

The Web TypeScript rules and Python Multiplayer Authority read gameplay
fixtures independently. A fixture describes observable game behavior, not a
React, FastAPI, Redis, or CSS implementation detail.
