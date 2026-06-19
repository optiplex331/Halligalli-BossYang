# Halligalli Helm Chart

This chart packages the standalone Halligalli runtime for Kubernetes. One Node.js container serves the built frontend assets, `/readyz`, `/health`, and same-origin socket.io traffic.

The chart is public application packaging only. Real Azure Kubernetes Desired State, production values, Argo CD Applications, namespace binding, and image selection belong in the infrastructure repository.

Rendering or validating this chart is local/static review only. It does not create Azure resources, deploy to a cluster, move DNS, publish images, or mutate Azure Kubernetes Desired State.

## Runtime Contract

- Renders one `Deployment` with exactly one replica.
- Defaults the `Deployment` strategy to `RollingUpdate` with `maxSurge: 0` and `maxUnavailable: 1` so single-node proof clusters do not need spare pod capacity for rollback.
- Renders one `Service`.
- Optionally renders one `Ingress`.
- Uses `/readyz` for readiness and `/health` for liveness and release identity checks.
- Does not set `VITE_HALLIGALLI_BACKEND_URL`; the standalone frontend connects to same-origin socket.io.
- Does not render Kubernetes `Secret` objects. Use `secretEnvFrom` only to reference externally managed secrets if a future runtime setting needs one.

## Image Contract

The chart supports digest-pinned deployments while keeping a human-readable release identity:

```yaml
image:
  repository: ghcr.io/optiplex331/halligalli-bossyang
  tag: "0.4.0"
  digest: "sha256:0000000000000000000000000000000000000000000000000000000000000000"

releaseIdentity:
  version: "0.4.0"
  commit: "0000000000000000000000000000000000000000"
```

When `image.digest` is set, the rendered image is `repository@sha256:...`. `image.tag` remains available for humans, labels, review, and `/health` identity. The chart rejects `image.tag: latest`.

The current default CI Release Image is the standalone image built with:

```bash
docker build --target standalone \
  --build-arg APP_VERSION=0.4.0 \
  --build-arg COMMIT_SHA=<release-commit-sha> \
  -t ghcr.io/optiplex331/halligalli-bossyang:0.4.0 .
```

## Local Rendering

Prerequisites:

- Node.js 24 and pnpm 11.
- Helm 3 or 4 available on `PATH`.
- Dependencies installed with `pnpm install`.

```bash
helm lint charts/halligalli
helm template halligalli charts/halligalli
helm template halligalli charts/halligalli \
  -f examples/kubernetes/standalone-values.yaml
```

The example values use placeholder hosts and a syntactically valid placeholder digest. Replace them in real desired state outside this repository.

For the full local Kubernetes package validation path, run:

```bash
pnpm run validate:kubernetes
```

This command lints the chart, renders it with `examples/kubernetes/standalone-values.yaml`, and checks the rendered manifests for the standalone same-origin contract, single replica, probes, resources, absence of rendered Secrets, and digest-pinned image support. It does not contact Azure, use kubeconfig, create cloud resources, update DNS, publish images, or deploy to a cluster.

## Single Replica

`replicaCount` is intentionally fixed at `1`. Multiplayer Authority is still in-process in the Node.js runtime, with room state and socket.io events owned by one server process. Multi-replica multiplayer is deferred until that authority is externalized or socket.io routing is redesigned.

## Rollout Strategy

The default strategy is proof-friendly for short-lived, single-replica clusters:

```yaml
deploymentStrategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 0
    maxUnavailable: 1
```

This allows Kubernetes rollback or image changes to terminate the old pod before creating the replacement pod, avoiding an extra temporary pod on single-node clusters with tight pod-count limits. Set `deploymentStrategy.type: Recreate` or provide another Kubernetes `RollingUpdate` shape in real desired state only after confirming the target cluster has the required availability and capacity.
