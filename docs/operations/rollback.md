# Rollback

Rollback for the AKS Portfolio Proof Environment is a GitOps desired-state operation. Terraform should not be used for ordinary application rollback unless the infrastructure itself is broken.

The historical Container Apps rollback path is no longer the active fallback after AKS cutover. Its Terraform-managed Azure resources were destroyed; use the old path only for historical inspection unless a future ADR recreates it.

## Preferred Rollback

1. Identify the previous known-good schema-V2 Paired Release and its Web/API digests.
2. Revert or edit Azure Kubernetes Desired State in the Infrastructure Repo to the previous complete pair and matching display-only `releaseVersion`.
3. Let Argo CD sync or trigger a manual sync after review.
4. Run the Infrastructure Repo Pod-digest verifier and require every current
   Ready Web/API business container `imageID` to match the selected digest.
5. Verify Web readiness, API `/internal/ready`, and a REST/native-WebSocket
   multiplayer journey. `/internal/identity` may be captured as diagnostic
   build content, but it is not deployment proof.

## Emergency Containment

If infrastructure recovery is required during a proof window, use the
Infrastructure Repo procedure for cluster, ingress, certificate, or Argo CD
recovery. Do not recover by reactivating Container Apps as fallback unless a new
explicit decision reverses ADR-0016.

## What Not To Do

- Do not push directly to `master`.
- Do not deploy `latest`.
- Do not run the infrastructure repo's Terraform `destroy` as application rollback.
- Do not use untracked local `.env`, Container Apps config JSON, or Azure credentials as deployment evidence.
- Do not deploy an image that is not tied to a Release Tag or reviewed digest.

## Verification

After an approved proof rollback, verify through the public origin and internal
API service path:

```bash
curl --fail --silent --show-error "https://play.halligalli.games/"
```

Then run the Infrastructure Repo Pod-digest verifier, verify API
`/internal/ready` through the approved internal path, and execute a real
four-seat/two-human or eight-seat/two-human
journey. The completed
proof record, not a current URL response, is the source of truth when no proof
window is active.
