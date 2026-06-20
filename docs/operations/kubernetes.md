# Kubernetes

Azure Kubernetes Production runs the standalone Halligalli runtime: one Node.js process serves built frontend assets, `/readyz`, `/health`, and same-origin socket.io behind `https://play.halligalli.games`.

The production-used Helm Chart, Argo CD Application, production values, ingress host, TLS intent, namespace binding, and digest-pinned image selection live in the Azure Production Infrastructure Repo under `gitops/azure-kubernetes-production/`. This product repository owns the application runtime and GHCR standalone Release Images, not the production render surface.

## Product Runtime Contract

The Kubernetes runtime uses the Dockerfile `standalone` target. That target includes both the Vite build output and the Node.js/socket.io server in one image.

```bash
docker build --target standalone -t halligalli-arena:standalone .
docker run --rm -p 3001:3001 halligalli-arena:standalone
curl --fail http://localhost:3001/readyz
curl --fail http://localhost:3001/health
```

For active production, Release Tags build, scan, and publish immutable standalone GHCR images. The infrastructure repo then selects a reviewed image digest in Azure Kubernetes Desired State.

## Same-Origin Traffic

The active runtime serves one public origin:

```text
https://play.halligalli.games
```

The same origin handles:

- frontend assets
- `/readyz`
- `/health`
- `/socket.io`

Do not set `VITE_HALLIGALLI_BACKEND_URL` for active AKS production. The old `https://api.halligalli.games` backend entry belongs only to the historical Container Apps-backed Azure Production path.

## Active Production Ownership

Use the infrastructure repo for production Kubernetes work:

| Concern | Owner |
|---|---|
| Production-used Helm Chart | Azure Production Infrastructure Repo |
| Argo CD Application | Azure Production Infrastructure Repo |
| Production values and image digest | Azure Production Infrastructure Repo |
| AKS Terraform and runbooks | Azure Production Infrastructure Repo |
| Product source, tests, build, and standalone image | Child Repo |

Child Repo pull requests must not introduce real Azure Kubernetes Desired State, kubeconfigs, rendered live manifests, Kubernetes Secrets, cloud credentials, or production chart templates.

## Rollback Shape

Application rollback is a GitOps desired-state change in the infrastructure repo:

1. Identify the previous known-good standalone Release Image digest and release commit.
2. Revert or edit Azure Kubernetes Desired State to the previous digest and matching `releaseIdentity`.
3. Let Argo CD sync or trigger a manual sync after review.
4. Verify `https://play.halligalli.games/readyz`, `https://play.halligalli.games/health`, and a socket.io multiplayer room.

If ingress, certificate, cluster, or Argo CD infrastructure is broken, use the Azure Kubernetes Production infrastructure runbook. Do not recover by reactivating Container Apps as fallback unless a future ADR explicitly reverses the AKS cutover decision.
