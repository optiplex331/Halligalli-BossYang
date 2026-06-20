# Standalone Release Image Migration Plan

This is the completed migration record for making the standalone Halligalli image the default Release Image.

Azure Kubernetes Production has been explicitly confirmed as the only active production environment. The current `Container` workflow builds the `standalone` Docker target, and Container Apps backend-only images are historical.

## Why Standalone Becomes The Future Default

Azure Kubernetes Production deploys Halligalli as one same-origin Kubernetes workload behind Ingress:

- `https://play.halligalli.games` serves the built frontend.
- The same origin serves `/readyz`, `/health`, and `/socket.io`.
- The infrastructure-owned Halligalli Helm Chart renders one single-replica Deployment because Multiplayer Authority remains in-process.
- Argo CD consumes Azure Kubernetes Desired State from the infrastructure repository and reconciles a digest-pinned image.

That shape requires the Dockerfile `standalone` target. The historical backend-only Azure Container Apps image target intentionally omitted Vite `dist/index.html` and `dist/assets/`, so it cannot be the primary AKS artifact for same-origin frontend plus socket.io delivery.

Making standalone the default gives the portfolio story one immutable artifact path:

```text
Release Tag -> scanned GHCR standalone Release Image -> Azure Kubernetes Desired State -> Argo CD -> AKS
```

The human-readable Release Identity stays the same: Release Tags produce `APP_VERSION` without the leading `v`, and `/health` reports that version plus the release commit SHA. The digest, not the tag, remains the deploy target.

## Historical Default

Before AKS cutover, these contracts existed:

- `.github/workflows/container.yml` builds `docker build .` without `--target`; because the final Dockerfile stage is `azure-backend`, this publishes the Azure Container Apps backend image.
- Release tags publish `ghcr.io/<owner>/<repo>:X.Y.Z` as the backend Release Image.
- The image is scanned before publication and is never tagged `latest`.
- A local backend rollout script resolved `ghcr.io/<owner>/<repo>:X.Y.Z` to `ghcr.io/<owner>/<repo>@sha256:<digest>` before updating Container Apps.
- A manual Azure Production workflow published Static Web Apps frontend assets separately with `VITE_HALLIGALLI_BACKEND_URL=https://api.halligalli.games`.
- `api.halligalli.games` was the Backend Entry for the Container Apps-backed Azure Production path.

ADR-0016 supersedes those defaults for active production.

## Applied Workflow Shape

After explicit cutover confirmation, the release control-plane shape is:

1. The `Container` workflow build step builds the standalone target for product/runtime PR validation, master integration images, and Release Tag images:

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

5. Container Apps does not remain a maintained fallback after the default tag changes. If a future decision reintroduces legacy backend deployment, add an explicit legacy backend artifact instead of overloading the canonical tag.

6. Release utility tests need changes only if output names, artifact suffixes, or publish decisions change. Since the canonical tag remains `X.Y.Z`, the existing image identity outputs mean "the default Release Image", now standalone.

7. Operation docs now state:

   - `docs/operations/ci-cd.md`: default Release Image target is standalone.
   - `docs/operations/kubernetes.md`: Azure Kubernetes Production is active and the infrastructure repo owns the chart plus desired-state render surface.
   - `docs/operations/azure-production.md`: Container Apps is historical with destroyed Terraform-managed resources, not fallback.
   - `docs/operations/rollback.md`: AKS rollback is the primary rollback path.

Do not change branch protection check names. `Product checks` and `Container build and scan` should remain stable; only the work performed inside the container check changes.

## Digest Flow Into Azure Kubernetes Desired State

The AKS deployment should use this flow:

1. Merge a Release PR.
2. Release Please creates `vX.Y.Z`.
3. The `Container` workflow builds, scans, and pushes the standalone Release Image as `ghcr.io/<owner>/<repo>:X.Y.Z`.
4. The workflow logs and job output record the pushed digest, for example `sha256:<64 lowercase hex characters>`.
5. A human or later automation opens a desired-state change in the Azure Production Infrastructure Repo.
6. The infrastructure-owned values select the infrastructure-owned chart and pin the image by digest:

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

The infrastructure-owned Helm Chart renders `repository@sha256:<digest>` when `image.digest` is set. `image.tag` remains human-readable context for reviews, labels, and `/health`; it is not the mutable deployment selector.

## Rollback Implications

### AKS Path

AKS rollback should be a GitOps desired-state change, not a rebuilt image and not a Terraform rollback:

1. Identify the previous known-good standalone Release Image digest and release commit.
2. Revert or edit Azure Kubernetes Desired State in the infrastructure repository to the previous digest and matching `releaseIdentity`.
3. Let Argo CD sync or trigger a manual sync after review.
4. Verify `https://play.halligalli.games/readyz`, `https://play.halligalli.games/health`, and a socket.io multiplayer room.
5. Confirm `/health` reports the expected `version` and `commit`.

If the failure is ingress, certificate, cluster, or Argo CD infrastructure rather than application runtime, use the Azure Kubernetes Production infrastructure runbooks. Do not treat Terraform `destroy` as application rollback.

### Historical Container Apps Path

Before AKS cutover, legacy rollback used a backend Release Tag, local Container Apps backend rollout, optional Static Web Apps frontend redeploy, and split-origin smoke checks against `api.halligalli.games` plus `play.halligalli.games`.

After ADR-0016, Container Apps is not a short-lived fallback or maintained legacy path. The executable workflow and backend deployment script have been removed. If a future decision reverses that, publish an explicitly named backend-only legacy artifact and add a new deployment adapter with fresh review.

The main risk is artifact identity ambiguity. Once `ghcr.io/<owner>/<repo>:X.Y.Z` becomes standalone, any legacy adapter that assumes the same tag is backend-only must stay retired unless it selects a separate legacy backend artifact.

## Cutover Checklist

- Explicit human confirmation says Azure Kubernetes Production is the only active production environment.
- The infrastructure-owned Halligalli Helm Chart and GitOps desired-state validation are green.
- Azure Kubernetes Desired State exists in the infrastructure repository and uses digest-pinned images.
- The `Container` workflow scans and pushes the standalone target before desired state consumes it.
- The selected standalone digest, release version, and commit SHA are recorded in the desired-state change.
- Rollback to a previous standalone digest is tested through Argo CD.
- Container Apps-backed Azure Production is historical with destroyed Terraform-managed resources unless a future ADR reverses the cutover posture.
