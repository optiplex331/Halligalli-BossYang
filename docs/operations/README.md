# Operations

These documents describe the product-owned delivery and runtime contracts for Halligalli. Active Azure Kubernetes Production infrastructure, Helm chart templates, Argo CD Application manifests, production values, and digest selection live in the infrastructure repository, not this product repository.

## Current Documents

| Document | Purpose |
|---|---|
| [CI/CD](ci-cd.md) | Explains GitHub Actions gates, Release Please, standalone GHCR image publication, and the digest handoff to Azure Kubernetes Desired State. |
| [Kubernetes](kubernetes.md) | Defines the product runtime contract that AKS consumes: the Dockerfile `standalone` target, same-origin traffic, health endpoints, and repository ownership boundary. |
| [Rollback](rollback.md) | Summarizes application rollback as a GitOps desired-state change to a previous standalone release-image digest. |
| [Azure Production History](azure-production.md) | Preserves the retired Static Web Apps plus Container Apps production shape as historical context only. |

## Active Production Boundary

Azure Kubernetes Production is the only active production environment after the June 19, 2026 cutover. Product releases publish immutable standalone GHCR images from Release Tags. Production rollout selects reviewed image digests in the infrastructure repository and reconciles them through Argo CD.

Container Apps-backed Azure Production is not an active fallback. Do not reintroduce Static Web Apps deployment, Container Apps rollout scripts, production chart templates, real desired state, kubeconfigs, secrets, rendered live manifests, or Terraform roots in this product repository unless a future ADR explicitly changes the repository boundary.
