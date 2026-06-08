# Rollback

Rollback for Azure Production Scaffold is an application deployment operation. Terraform should not be used for ordinary application rollback unless the infrastructure itself is broken.

## Preferred Rollback

1. Find a known-good GitHub Release, Release Tag, or previously deployed GHCR digest reference from workflow logs.
2. Run `Azure Production Scaffold` with `operation=deploy-backend` and `confirm_cost=AZURE_PRODUCTION_APPLY` from the known-good Release Tag.
3. Run `operation=deploy-frontend` if frontend assets also need to roll back.
4. Run `operation=smoke-backend` with `expected_version` and `expected_commit` when those values are known.
5. Check `https://play.halligalli.games`, `https://api.halligalli.games/readyz`, `/health`, and a socket.io multiplayer room.

## Emergency Containment

If the scaffold must recover before a clean redeploy can complete, use Azure portal or CLI controls to point the Container App at a previous healthy revision, then follow with a normal `Azure Production Scaffold` workflow run so GitHub Actions logs capture the restored runtime identity.

## What Not To Do

- Do not push directly to `master`.
- Do not deploy `latest`.
- Do not run Terraform `destroy` as application rollback.
- Do not use untracked local `.env`, tfvars, Container Apps config JSON, or Azure credentials as the source of truth.
- Do not bypass the protected `azure-production-scaffold` GitHub Environment for normal rollback.

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
