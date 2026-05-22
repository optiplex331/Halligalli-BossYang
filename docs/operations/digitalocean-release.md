# DigitalOcean Release

Halligalli Stage 1 keeps DigitalOcean App Platform as the only live production environment. The release is controlled by GitHub Actions; DigitalOcean `deploy_on_push` is disabled to avoid racing GitHub's release workflow.

## Production App

| Field | Value |
|---|---|
| App Platform app | `halligalli` |
| Service | `web` |
| Region | `ams` |
| Release branch | `master` |
| Runtime | Node.js single service |
| HTTP port | `3001` |
| App spec | `.do/app.yaml` |

The app spec keeps the existing source-based DO runtime. GHCR images are published as traceable release artifacts, but Stage 1 does not switch DO Production to image-based deployment.

## Required GitHub Configuration

Create these repository settings before running the production release workflow:

| Type | Name | Purpose |
|---|---|---|
| Secret | `DO_API_TOKEN` | Authenticates `doctl` in GitHub Actions. |
| Variable | `DO_APP_ID` | Identifies the DO Production app. |
| Variable | `DO_PRODUCTION_URL` | Live base URL used for `/health` smoke tests. |

Do not commit token values or local `.env` files.

## First Stage 1 Cutover

Before merging the Stage 1 branch to `master`, disable DigitalOcean platform auto-deploy for the production app. Either apply `.do/app.yaml` through the DigitalOcean UI/API or toggle `deploy_on_push` off in App Platform. This prevents the merge commit from being deployed once by DigitalOcean and then again by GitHub Actions.

The committed app spec has:

```yaml
github:
  branch: master
  deploy_on_push: false
```

After cutover, GitHub Actions is the production deployment trigger.

## Release Metadata

The release workflow injects:

```text
APP_VERSION=<base-version>-<distance>-g<short-sha>
COMMIT_SHA=<full commit sha>
```

The server exposes that identity at `/health`:

```json
{
  "status": "ok",
  "rooms": 0,
  "version": "0.1.0-0004-gabc1234",
  "commit": "abc1234..."
}
```

Local development falls back to `version: "local"` and `commit: "unknown"` when release metadata is absent.

## Smoke Test

The release workflow calls:

```text
<DO_PRODUCTION_URL>/health
```

It fails unless:

- `status` is `ok`
- `version` equals the release version tag
- `commit` equals the released full commit SHA

This makes the GitHub Actions result reflect the deployed revision, not just the build result.

## Deployment Trace

For a production release, map the deployed system with:

- GitHub commit SHA from the `Release DO Production` workflow log
- app version from `/health.version`
- GHCR tag from the `Container` workflow log
- DO deployment ID from the `Deploy DO Production` step

Use `doctl apps logs <app-id> --deployment <deployment-id> --type build|run` when investigating a failed deployment.
