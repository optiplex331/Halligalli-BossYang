# DigitalOcean Production

Halligalli Production runs on DigitalOcean App Platform as a Node.js 24 single-service app driven by GHCR images. GitHub Actions reconciles DigitalOcean from the Git-tracked Production Manifest at `deploy/production/app.yaml`.

## Production App

| Field | Value |
|---|---|
| App Platform app | `halligalli` |
| Service | `web` |
| Region | `ams` |
| Release branch | `master` |
| Runtime | GHCR image built from the Node.js 24 single-service Dockerfile |
| HTTP port | `3001` |
| Production Manifest | `deploy/production/app.yaml` |

## Required GitHub Configuration

Create these GitHub settings before running the release flow:

| Location | Type | Name | Purpose |
|---|---|---|---|
| Repository | Secret | `HALLIGALLI_RELEASE_BOT_TOKEN` | Allows Release Please and promotion workflows to open PRs that trigger follow-on checks. |
| Environment `do-production` | Secret | `DO_API_TOKEN` | Authenticates `doctl` in GitHub Actions. |
| Environment `do-production` | Variable | `DO_APP_ID` | Identifies the DO Production app. |
| Environment `do-production` | Variable | `DO_PRODUCTION_URL` | Live base URL for `/health` smoke tests. |

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

Do not use `latest` for production. The release workflow may publish a human-readable version tag, but DigitalOcean should run the digest recorded in Git.

Production Manifest release identity reads and writes in GitHub Actions should go through provider-neutral `.github/utils/*.py` helpers. The helpers may understand the current DigitalOcean manifest shape internally, but workflows should not scatter DigitalOcean-specific YAML parsing across shell steps. That keeps a future production provider change localized to the helpers and a small amount of CLI orchestration.

## Release Identity

The Production Manifest injects release identity into the app:

```text
APP_VERSION=X.Y.Z
COMMIT_SHA=<full commit sha>
```

The server exposes that identity on `/health`:

```json
{
  "status": "ok",
  "rooms": 0,
  "version": "1.2.0",
  "commit": "abc1234..."
}
```

`/health` smoke tests and drift checks should reuse the dependency-free Python scripts in `.github/utils/*.py`. Simple `curl` calls and retry loops may stay in Bash.

## Promotion Flow

1. Merge the Release Please PR, creating a `vX.Y.Z` tag.
2. The tag triggers the GHCR image build, scan, and push.
3. The build workflow resolves the pushed image digest.
4. The build workflow opens a Production Promotion PR that updates `deploy/production/app.yaml`.
5. The Production Promotion PR runs stable required checks routed to manifest validation rather than rebuilding the already published image.
6. Merge the Production Promotion PR.
7. `Reconcile DO Production` applies the manifest and smoke tests `/health`.

## Deployment Trace

Use these records to trace a production deployment:

- the GitHub Release and Release Tag
- the image digest in `deploy/production/app.yaml`
- the app version and commit returned by `/health`
- the DO deployment ID in the `Reconcile DO Production` workflow log

For failed deployment investigation, use:

```bash
doctl apps logs <app-id> --deployment <deployment-id> --type run
```

## Manual Reconcile

Use the `Reconcile DO Production` workflow dispatch to re-apply the current Git-tracked manifest without changing the release version.
