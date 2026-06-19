# Kubernetes

Halligalli's public Kubernetes package is the [Halligalli Helm Chart](../../charts/halligalli/README.md). It deploys the standalone runtime shape: one Node.js process serves static frontend assets, `/readyz`, `/health`, and same-origin socket.io.

This document describes the public application package for Azure Kubernetes Production. Real Azure Kubernetes Desired State belongs in the Azure Production Infrastructure Repo, not in this product repository. Container Apps-backed Azure Production is historical after cutover, and its Terraform-managed resources were destroyed.

## Safety Boundary

Normal chart rendering does not create Azure resources, update DNS, publish images, or deploy to a cluster.

Chart rendering still does not switch live DNS, bootstrap Argo CD, or mutate Azure resources. Those remain explicit infrastructure operations.

Keep these surfaces separate:

| Surface | Owner | Contents |
|---|---|---|
| Public chart | Child Repo | Templates, safe defaults, schema, examples, and public documentation. |
| Safe examples | Child Repo | Placeholder hosts, placeholder digests, no real environment values. |
| Azure Kubernetes Desired State | Azure Production Infrastructure Repo | Real namespace binding, Argo CD Application, production values, image digest, ingress host, and TLS issuer. |
| Cloud resources | Azure Production Infrastructure Repo | Terraform-managed AKS and related Azure infrastructure. |

Do not commit Kubernetes Secrets, cloud credentials, real production values, rendered live manifests, kubeconfigs, or local `.env` files.

## Standalone Runtime

The Kubernetes path uses the Dockerfile `standalone` target. That target includes both the Vite build output and the Node.js/socket.io server in one image.

```bash
docker build --target standalone -t halligalli-arena:standalone .
docker run --rm -p 3001:3001 halligalli-arena:standalone
curl --fail http://localhost:3001/readyz
curl --fail http://localhost:3001/health
```

For Azure Kubernetes Production, the deployed image should be a digest-pinned GHCR Release Image built from the standalone target.

The default Release Image has been switched from backend-only to standalone for AKS cutover. [Standalone Release Image Migration Plan](standalone-release-image-migration.md) remains the decision trail for that switch.

## Same-Origin Traffic

The Kubernetes runtime should serve one public origin:

```text
https://play.halligalli.games
```

The same origin handles:

- frontend assets
- `/readyz`
- `/health`
- `/socket.io`

Do not set `VITE_HALLIGALLI_BACKEND_URL` for this chart. The frontend should use same-origin socket.io. The old `api.halligalli.games` backend entry is historical after cutover.

## Image And Release Identity

Use an immutable image reference for real desired state:

```yaml
image:
  repository: ghcr.io/optiplex331/halligalli-bossyang
  tag: "0.4.0"
  digest: "sha256:<release-image-digest>"

releaseIdentity:
  version: "0.4.0"
  commit: "<release-commit-sha>"
```

When `image.digest` is set, the chart renders `ghcr.io/...@sha256:...`. The tag remains as human-readable release identity for reviews, labels, and `/health`.

Never deploy `latest`.

## Config And Secret Boundary

The runtime has no required application secret for the standalone path.

Use chart values this way:

| Value | Use |
|---|---|
| `config.allowedOrigins` | Optional non-secret CORS allow-list. Keep empty for same-origin operation. |
| `config.extraEnv` | Non-secret runtime environment variables only. |
| `secretEnvFrom` | References to externally managed Kubernetes Secrets, if a future runtime setting requires one. |

The chart intentionally does not render `Secret` objects. Real values for Azure Kubernetes Production belong in the infrastructure repository's GitOps desired state, not in public examples.

## Render Locally

Prerequisites for a clean Child Repo checkout:

- Node.js 24 and pnpm 11.
- Helm 3 or 4 available on `PATH`.
- Local dependencies installed with `pnpm install`.

```bash
helm lint charts/halligalli
helm template halligalli charts/halligalli
helm template halligalli charts/halligalli \
  -f examples/kubernetes/standalone-values.yaml
```

The default render emits a `Deployment` and `Service`. The example values also render an `Ingress` with placeholder host and TLS values.

## Validate Locally

Local validation does not create Azure resources, read Azure credentials, use a kubeconfig, create a cluster, update DNS, publish images, or deploy manifests.

```bash
pnpm run validate:kubernetes
```

The command runs:

- `helm lint charts/halligalli`
- `helm lint charts/halligalli -f examples/kubernetes/standalone-values.yaml`
- `helm template halligalli charts/halligalli -f examples/kubernetes/standalone-values.yaml`
- rendered manifest contract checks

The rendered contract check verifies that the safe example values produce the intended standalone package shape:

- exactly one `Deployment`
- exactly one replica
- `RollingUpdate` strategy with `maxSurge: 0` and `maxUnavailable: 1` for single-node rollback proof
- exactly one `Service`
- no rendered Kubernetes `Secret`
- optional `Ingress` routes `/` with `Prefix` to the rendered Service for same-origin traffic
- digest-pinned image reference support through `repository@sha256:<digest>`
- `/health` liveness probe and `/readyz` readiness probe
- resource requests and limits
- `PORT`, `APP_VERSION`, and `COMMIT_SHA` environment variables
- no `VITE_HALLIGALLI_BACKEND_URL`

## Expected Rendered Contract

The rendered workload should have:

- exactly one `Deployment`
- exactly one replica
- `RollingUpdate` strategy with `maxSurge: 0` and `maxUnavailable: 1`
- one `Service`
- optional `Ingress`
- `/readyz` readiness probe
- `/health` liveness probe
- configurable resource requests and limits
- `PORT`, `APP_VERSION`, and `COMMIT_SHA` environment variables
- no `VITE_HALLIGALLI_BACKEND_URL`
- no rendered Kubernetes `Secret`

## Multiplayer Scaling Boundary

Multi-replica multiplayer is intentionally deferred. The Multiplayer Authority is still in-process: `server/GameEngine.ts`, room state, timers, and socket.io event ownership live inside one Node.js process. Scaling the Deployment above one replica would split that authority across pods and make room state and socket routing inconsistent.

Keep `replicaCount: 1` until Multiplayer Authority state is externalized or socket.io routing is redesigned and tested.

## Rollback Shape

Kubernetes rollback should be a GitOps desired-state change to a previous digest-pinned image:

```yaml
image:
  tag: "0.4.0"
  digest: "sha256:<previous-good-digest>"
releaseIdentity:
  version: "0.4.0"
  commit: "<previous-good-commit>"
```

The chart defaults to a no-surge single-replica rollout strategy:

```yaml
deploymentStrategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 0
    maxUnavailable: 1
```

This is intentional for short-lived proof clusters and small Free tier nodes where a rollback cannot temporarily run old and new application pods at the same time. The tradeoff is a short application interruption during rollout or rollback. Use a different `deploymentStrategy` in real Azure Kubernetes Desired State only after confirming the cluster has spare pod capacity and the Multiplayer Authority availability tradeoff is acceptable.

After Argo CD syncs that change, verify:

```bash
curl --fail https://play.halligalli.games/readyz
curl --fail https://play.halligalli.games/health
```

`/health` should report the expected `version` and `commit`.

## DNS And Browser WebSocket Proof

If `play.halligalli.games` still points at the historical Container Apps-backed Azure Production frontend, AKS proof is incomplete for real public HTTPS and browser WebSocket traffic. Cluster-local or temporary-host checks can prove the pod, Service, Ingress controller, and placeholder host routing, but they do not prove the final browser origin.

Before treating a live AKS cutover run as complete, move or temporarily delegate `play.halligalli.games` to the AKS ingress endpoint with a valid TLS certificate, then verify:

```bash
curl --fail https://play.halligalli.games/readyz
curl --fail https://play.halligalli.games/health
```

Also create a browser multiplayer room through `https://play.halligalli.games` and confirm socket.io upgrades over WSS on the same origin. Do not set `VITE_HALLIGALLI_BACKEND_URL` for this proof.
