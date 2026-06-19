# Standalone Release Image Migration Plan

This is the Phase B migration plan for making the standalone Halligalli image the default Release Image. It is not active yet.

Azure Kubernetes Production must be explicitly confirmed before this plan is implemented. Until then, the current Azure Container Apps backend image remains the default Release Image and the release workflows must not switch targets.

## Why Standalone Becomes The Future Default

Azure Kubernetes Production deploys Halligalli as one same-origin Kubernetes workload behind Ingress:

- `https://play.halligalli.games` serves the built frontend.
- The same origin serves `/readyz`, `/health`, and `/socket.io`.
- The Halligalli Helm Chart renders one single-replica Deployment because Multiplayer Authority remains in-process.
- Argo CD consumes Azure Kubernetes Desired State from the infrastructure repository and reconciles a digest-pinned image.

That shape requires the Dockerfile `standalone` target. The current backend-only image intentionally omits Vite `dist/index.html` and `dist/assets/`, so it cannot be the primary AKS artifact for same-origin frontend plus socket.io delivery.

Making standalone the future default also gives the portfolio story one immutable artifact path:

```text
Release Tag -> scanned GHCR standalone Release Image -> Azure Kubernetes Desired State -> Argo CD -> AKS
```

The human-readable Release Identity stays the same: Release Tags produce `APP_VERSION` without the leading `v`, and `/health` reports that version plus the release commit SHA. The digest, not the tag, remains the deploy target.

## Current Default To Preserve

Before Phase B confirmation, keep these contracts unchanged:

- `.github/workflows/container.yml` builds `docker build .` without `--target`; because the final Dockerfile stage is `azure-backend`, this publishes the Azure Container Apps backend image.
- Release tags publish `ghcr.io/<owner>/<repo>:X.Y.Z` as the backend Release Image.
- The image is scanned before publication and is never tagged `latest`.
- `scripts/deploy-azure-production-backend.sh` resolves `ghcr.io/<owner>/<repo>:X.Y.Z` to `ghcr.io/<owner>/<repo>@sha256:<digest>` before updating Container Apps.
- `.github/workflows/azure-production.yml` continues to publish Static Web Apps frontend assets separately with `VITE_HALLIGALLI_BACKEND_URL=https://api.halligalli.games`.
- `api.halligalli.games` remains the active Backend Entry for the Container Apps-backed Azure Production path.

This slice does not change those defaults.

## Phase B Workflow Changes

After explicit Phase B migration confirmation, make the release control-plane changes in one reviewed change set:

1. Change the `Container` workflow build step to build the standalone target for product/runtime PR validation, master integration images, and Release Tag images:

   ```bash
   docker build --target standalone ...
   ```

2. Scan the same standalone image that will be pushed. Do not scan the backend target while publishing the standalone target.

3. Keep Release Tag identity stable unless a separate dual-artifact transition is deliberately chosen:

   ```text
   ghcr.io/<owner>/<repo>:X.Y.Z
   ```

   After migration, this tag should mean the standalone Release Image. It must still resolve to a digest before deployment and must still avoid `latest`.

4. Keep the existing build arguments and OCI labels aligned with `/health`:

   - `APP_VERSION=X.Y.Z`
   - `COMMIT_SHA=<release-commit-sha>`
   - `org.opencontainers.image.version=X.Y.Z`
   - `org.opencontainers.image.revision=<release-commit-sha>`

5. If Container Apps must remain a maintained fallback after the default tag changes, add an explicit legacy backend artifact instead of overloading the canonical tag. Use a clearly separate identity such as `X.Y.Z-azure-backend` or a dedicated legacy workflow output, then update only the legacy deployment script/docs to consume that artifact. Do not let the AKS desired state consume the legacy backend artifact.

6. Update release utility tests if any output names, artifact suffixes, or publish decisions change. If the canonical tag remains `X.Y.Z`, the existing image identity outputs can continue to mean "the default Release Image" and the documentation should state that the default is now standalone.

7. Update operation docs at the same time:

   - `docs/operations/ci-cd.md`: default Release Image target is standalone.
   - `docs/operations/kubernetes.md`: Phase B is active and desired state consumes the canonical standalone release digest.
   - `docs/operations/azure-production.md`: Container Apps is legacy or fallback, not the primary delivery path.
   - `docs/operations/rollback.md`: AKS rollback is the primary rollback path.

Do not change branch protection check names. `Product checks` and `Container build and scan` should remain stable; only the work performed inside the container check changes.

## Digest Flow Into Azure Kubernetes Desired State

The future AKS deployment should use this flow:

1. Merge a Release PR.
2. Release Please creates `vX.Y.Z`.
3. The `Container` workflow builds, scans, and pushes the standalone Release Image as `ghcr.io/<owner>/<repo>:X.Y.Z`.
4. The workflow logs and job output record the pushed digest, for example `sha256:<64 lowercase hex characters>`.
5. A human or later automation opens a desired-state change in the Azure Production Infrastructure Repo.
6. The infrastructure-owned values select the public chart and pin the image by digest:

   ```yaml
   image:
     repository: ghcr.io/optiplex331/halligalli-bossyang
     tag: "X.Y.Z"
     digest: "sha256:<standalone-release-image-digest>"

   releaseIdentity:
     version: "X.Y.Z"
     commit: "<release-commit-sha>"
   ```

7. Argo CD syncs the Azure Kubernetes Desired State into AKS.
8. Verify the reconciled runtime:

   ```bash
   curl --fail https://play.halligalli.games/readyz
   curl --fail https://play.halligalli.games/health
   ```

The Helm Chart renders `repository@sha256:<digest>` when `image.digest` is set. `image.tag` remains human-readable context for reviews, labels, and `/health`; it is not the mutable deployment selector.

## Rollback Implications

### Future AKS Path

AKS rollback should be a GitOps desired-state change, not a rebuilt image and not a Terraform rollback:

1. Identify the previous known-good standalone Release Image digest and release commit.
2. Revert or edit Azure Kubernetes Desired State in the infrastructure repository to the previous digest and matching `releaseIdentity`.
3. Let Argo CD sync or trigger a manual sync after review.
4. Verify `https://play.halligalli.games/readyz`, `https://play.halligalli.games/health`, and a socket.io multiplayer room.
5. Confirm `/health` reports the expected `version` and `commit`.

If the failure is ingress, certificate, cluster, or Argo CD infrastructure rather than application runtime, use the Azure Kubernetes Production infrastructure runbooks. Do not treat Terraform `destroy` as application rollback.

### Legacy Container Apps Path

Before Phase B, legacy rollback remains the current Azure Production rollback:

1. Pick a known-good backend Release Tag.
2. Run `scripts/deploy-azure-production-backend.sh vX.Y.Z`.
3. Redeploy Static Web Apps frontend assets only if frontend assets also need to roll back.
4. Smoke `https://api.halligalli.games/readyz`, `https://api.halligalli.games/health`, `https://play.halligalli.games`, and socket.io.

After Phase B, decide whether Container Apps is a short-lived fallback or a maintained legacy path:

- Short-lived fallback: document the last known-good backend-only Release Tag and use it only to recover the old split frontend/backend path while AKS is being repaired.
- Maintained legacy path: publish an explicitly named backend-only legacy artifact and update the backend deployment script to resolve that artifact by digest. The canonical `X.Y.Z` tag should not mean both standalone and backend-only at the same time.

The main risk is artifact identity ambiguity. Once `ghcr.io/<owner>/<repo>:X.Y.Z` becomes standalone, any script that assumes the same tag is backend-only must either be retired, constrained to pre-migration tags, or taught to select a separate legacy backend artifact.

## Phase B Readiness Checklist

- Explicit human confirmation says Azure Kubernetes Production migration may begin.
- The Halligalli Helm Chart and `pnpm run validate:kubernetes` are green.
- Azure Kubernetes Desired State exists in the infrastructure repository and uses digest-pinned images.
- The team chooses whether Container Apps is retired, short-lived fallback, or maintained legacy.
- The `Container` workflow scans and pushes the standalone target before desired state consumes it.
- The selected standalone digest, release version, and commit SHA are recorded in the desired-state change.
- Rollback to a previous standalone digest is tested through Argo CD.
- If legacy Container Apps remains maintained, its backend-only artifact identity is explicit and separate from the canonical standalone Release Image.
