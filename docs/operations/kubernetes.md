# Kubernetes

The Child Repo supplies the Web and FastAPI API images consumed by the
Infrastructure Repo's closed Halligalli chart. The chart is used only for an
explicitly approved, short-lived AKS Portfolio Proof Environment; the completed
2026-07-13 proof was destroyed and no workload is currently deployed.

The Infrastructure Repo owns the chart, Argo CD Applications, proof values,
ingress, and digest selection. This document records the product runtime
contract, not a live-cluster operation procedure.

## Product Runtime Contract

The paired runtime has three components:

| Component | Product implementation | Container contract |
|---|---|---|
| Web | React/Vite build served by nginx | HTTP on port `8080`; readiness is `/` |
| API | FastAPI with native WebSocket and Redis authority | HTTP/WebSocket on port `8000`; readiness is `/internal/ready` |
| Redis | Ephemeral multiplayer state and concurrency substrate | Redis on port `6379`; no persistence or recovery |

Build both product images with the declared package command:

```bash
pnpm run images:build
```

Both images contain build-authored Release Identity. Web packages a generated
static JSON file and API packages `release-identity.json`; runtime environment
variables cannot rewrite either value. `/internal/identity` is diagnostic image
content, not proof of which digest Kubernetes actually runs. The API reads
`HALLIGALLI_REDIS_URL`; local Compose supplies the disposable Redis service.

## Routed Traffic

The proof chart exposes one public origin. Ingress sends:

| Path | Destination |
|---|---|
| `/` | Web Service |
| `/api/v1` | API Service |
| `/ws/v1` | API Service |

The API contract currently exposes room creation and joining under
`/api/v1/rooms`, room snapshots under `/api/v1/rooms/{room_code}`, and native
WebSocket commands under `/ws/v1/rooms/{room_code}`. `/internal/ready`,
`/internal/identity`, and `/internal/metrics` remain behind the API Service.

For same-origin browser traffic, leave `VITE_HALLIGALLI_BACKEND_URL` unset.
The optional variable is only for deliberate split-origin local or test runs.

## Repository Ownership

| Concern | Owner |
|---|---|
| Web/API source, tests, Dockerfiles, and release images | Child Repo |
| AKS Terraform and operation approval boundary | Infrastructure Repo |
| Helm chart, Argo CD Applications, proof values, and selected digests | Infrastructure Repo |
| Private planning, ADRs, and cross-repo learning | Workbench |

Child Repo pull requests must not introduce real Azure Kubernetes desired state,
kubeconfigs, rendered live manifests, Kubernetes Secrets, cloud credentials, or
production chart templates.

## Rollback Shape

Application rollback is a reviewed Infrastructure Repo desired-state change:

1. Identify a known-good schema-V2 Paired Release and its Web/API digests.
2. Change the GitOps values to that complete pair and matching display-only `releaseVersion`.
3. Let Argo CD reconcile after the Infrastructure review boundary.
4. Use the Infrastructure verifier to compare every current Web/API Pod
   `imageID` with the selected digests, then verify readiness and a
   four-seat/two-human or eight-seat/two-human REST/native-WebSocket journey.

Do not roll back one image independently, use a mutable tag, or recreate the
retired Container Apps path. If AKS, ingress, certificate, or Argo CD recovery
is required, use the Infrastructure Repo's AKS Portfolio Proof Procedure inside
a new explicitly approved proof window.
