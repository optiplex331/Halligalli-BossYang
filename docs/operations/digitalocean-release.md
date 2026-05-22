# DigitalOcean Release

Halligalli Stage 1 keeps DigitalOcean App Platform as the only live production environment. The release is controlled by GitHub Actions: the container workflow publishes a GHCR image, then the release workflow updates DigitalOcean to run that image tag.

## Production App

| Field | Value |
|---|---|
| App Platform app | `halligalli` |
| Service | `web` |
| Region | `ams` |
| Release branch | `master` |
| Runtime | GHCR image built from the Node.js single-service Dockerfile |
| HTTP port | `3001` |
| App spec | `.do/app.yaml` |

The app spec uses a GHCR image source:

```yaml
image:
  registry_type: GHCR
  registry: optiplex331
  repository: halligalli-bossyang
```

## Required GitHub Configuration

Create these repository settings before running the production release workflow:

| Type | Name | Purpose |
|---|---|---|
| Secret | `DO_API_TOKEN` | Authenticates `doctl` in GitHub Actions. |
| Variable | `DO_APP_ID` | Identifies the DO Production app. |
| Variable | `DO_PRODUCTION_URL` | Live base URL used for `/health` smoke tests. |
| Variable | `DO_GHCR_USERNAME` | Optional GHCR username for private image pulls. |
| Secret | `DO_GHCR_TOKEN` | Optional GHCR read token paired with `DO_GHCR_USERNAME`. |

If the GHCR package is public, the optional GHCR pull credentials are not required. If it is private, provide a long-lived read-only token so DigitalOcean can pull the image. Do not commit token values or local `.env` files.

## First Stage 1 Cutover

Before merging the Stage 1 branch to `master`, make sure the `v0.1.0` git tag exists and has been pushed. Release metadata is derived only from `vX.Y.Z` git tags.

The committed app spec has:

```yaml
image:
  registry_type: GHCR
  tag: latest # production_halligalli-web
```

The committed `latest` value is a placeholder. The release workflow renders a temporary app spec and replaces the marked `tag` line with the immutable image tag for the released commit. After cutover, GitHub Actions is the production deployment trigger.

## Release Metadata

The release workflow injects the same identity into the DigitalOcean app spec and the Docker image build:

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

Use `doctl apps logs <app-id> --deployment <deployment-id> --type run` when investigating a failed deployment.
