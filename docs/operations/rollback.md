# Rollback

Rollback for Azure Production is an application deployment operation. Terraform should not be used for ordinary application rollback unless the infrastructure itself is broken.

The current rollback path below is for the Container Apps-backed Azure Production path. The future AKS rollback shape, plus the implications of switching the default Release Image to standalone, is documented in [Standalone Release Image Migration Plan](standalone-release-image-migration.md).

## Preferred Rollback

1. Find a known-good GitHub Release, Release Tag, or previously deployed GHCR backend image digest reference from workflow logs.
2. Run `scripts/deploy-azure-production-backend.sh vX.Y.Z` locally from the known-good Release Tag.
3. Run `operation=deploy-frontend` if Static Web Apps frontend assets also need to roll back.
4. Run `operation=smoke-backend` with `expected_version` and `expected_commit` when those values are known.
5. Check `https://play.halligalli.games`, `https://api.halligalli.games/readyz`, `/health`, and a socket.io multiplayer room.

## Emergency Containment

If Azure Production must recover before a clean redeploy can complete, use Azure portal or CLI controls to point the Container App at a previous healthy revision, then follow with the normal local backend deployment script so `/health` captures the restored runtime identity.

## What Not To Do

- Do not push directly to `master`.
- Do not deploy `latest`.
- Do not run the infrastructure repo's Terraform `destroy` as application rollback.
- Do not use untracked local `.env`, Container Apps config JSON, or Azure credentials as the source of truth for release identity.
- Do not deploy a backend image that is not tied to a Release Tag.

## Verification

After rollback, run:

```bash
curl --fail --silent --show-error "$AZURE_PRODUCTION_BACKEND_URL/readyz"
curl --fail --silent --show-error "$AZURE_PRODUCTION_BACKEND_URL/health"
```

The `/health` response should report:

- `status: "ok"`
- the expected `version`
- the expected `commit`
- a reasonable `rooms` count
