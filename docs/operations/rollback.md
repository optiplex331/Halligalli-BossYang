# Rollback

Rollback for Azure Kubernetes Production is a GitOps desired-state operation. Terraform should not be used for ordinary application rollback unless the infrastructure itself is broken.

The historical Container Apps rollback path is no longer the active fallback after AKS cutover. Its Terraform-managed Azure resources were destroyed; use the old path only for historical inspection unless a future ADR recreates it.

## Preferred Rollback

1. Identify the previous known-good standalone Release Image digest and release commit.
2. Revert or edit Azure Kubernetes Desired State in the infrastructure repository to the previous digest and matching `releaseIdentity`.
3. Let Argo CD sync or trigger a manual sync after review.
4. Verify `https://play.halligalli.games/readyz`, `https://play.halligalli.games/health`, and a socket.io multiplayer room.
5. Confirm `/health` reports the expected `version` and `commit`.

## Emergency Containment

If AKS production must recover before a clean GitOps rollback can complete, use the Azure Kubernetes Production infrastructure runbook for cluster, ingress, certificate, or Argo CD recovery. Do not recover by reactivating Container Apps as fallback unless a new explicit decision reverses ADR-0016.

## What Not To Do

- Do not push directly to `master`.
- Do not deploy `latest`.
- Do not run the infrastructure repo's Terraform `destroy` as application rollback.
- Do not use untracked local `.env`, Container Apps config JSON, or Azure credentials as the source of truth for release identity.
- Do not deploy an image that is not tied to a Release Tag or reviewed digest.

## Verification

After rollback, run:

```bash
curl --fail --silent --show-error "https://play.halligalli.games/readyz"
curl --fail --silent --show-error "https://play.halligalli.games/health"
```

The `/health` response should report:

- `status: "ok"`
- the expected `version`
- the expected `commit`
- a reasonable `rooms` count
