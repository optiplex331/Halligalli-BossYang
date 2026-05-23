# DigitalOcean Production

Halligalli Production runs on DigitalOcean App Platform as one GHCR-backed Node.js service. GitHub Actions reconciles DigitalOcean from the Git-tracked Production Manifest at `deploy/production/app.yaml`.

## Production App

| Field | Value |
|---|---|
| App Platform app | `halligalli` |
| Service | `web` |
| Region | `ams` |
| Release branch | `master` |
| Runtime | GHCR image built from the Node.js single-service Dockerfile |
| HTTP port | `3001` |
| Production Manifest | `deploy/production/app.yaml` |

## Required GitHub Configuration

Create these settings before running the release flow:

| Location | Type | Name | Purpose |
|---|---|---|---|
| Repository | Secret | `HALLIGALLI_RELEASE_BOT_TOKEN` | Lets Release Please and promotion workflows open PRs that trigger follow-on checks. |
| Environment `do-production` | Secret | `DO_API_TOKEN` | Authenticates `doctl` in GitHub Actions. |
| Environment `do-production` | Variable | `DO_APP_ID` | Identifies the DO Production app. |
| Environment `do-production` | Variable | `DO_PRODUCTION_URL` | Live base URL used for `/health` smoke tests. |

Do not commit token values or local `.env` files.

## Production Manifest

The Production Manifest uses a GHCR image digest:

```yaml
image:
  registry_type: GHCR
  registry: optiplex331
  repository: halligalli-bossyang
  digest: sha256:...
```

Do not use `latest` in production. The release workflow may push a human-readable version tag, but DigitalOcean should run the digest recorded in Git.

## Release Identity

The Production Manifest injects release identity into the app:

```text
APP_VERSION=X.Y.Z
COMMIT_SHA=<full commit sha>
```

The server exposes that identity at `/health`:

```json
{
  "status": "ok",
  "rooms": 0,
  "version": "1.2.0",
  "commit": "abc1234..."
}
```

## Promotion Flow

1. Merge a Release Please PR to create a `vX.Y.Z` tag.
2. The tag builds, scans, and pushes a GHCR image.
3. The build workflow resolves the pushed image digest.
4. The build workflow opens a Production Promotion PR that updates `deploy/production/app.yaml`.
5. Merge the Production Promotion PR.
6. `Reconcile DO Production` applies the manifest and smoke tests `/health`.

## Deployment Trace

For a production release, map the deployed system with:

- Release Tag from the GitHub Release.
- image digest from `deploy/production/app.yaml`.
- app version and commit from `/health`.
- DO deployment ID from the `Reconcile DO Production` workflow log.

Use `doctl apps logs <app-id> --deployment <deployment-id> --type run` when investigating a failed deployment.

## Manual Reconcile

Use the `Reconcile DO Production` workflow dispatch to replay the current Git-tracked manifest without changing the release version.
