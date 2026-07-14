# Operations

These documents describe the product-owned delivery and runtime contracts for Halligalli. The Infrastructure Repo owns the short-lived AKS Portfolio Proof Environment, Helm chart templates, Argo CD Applications, proof values, and digest selection; the Product Repo owns the Web/API source and release artifacts.

## Current Documents

| Document | Purpose |
|---|---|
| [CI/CD](ci-cd.md) | Explains GitHub Actions gates, Release Please, paired Web/API GHCR image publication, and the digest handoff to Azure Kubernetes Desired State. |
| [Kubernetes](kubernetes.md) | Defines the Web/API/Redis runtime contract that the Infrastructure Repo chart consumes, including same-origin routing and internal readiness. |
| [Rollback](rollback.md) | Summarizes paired application rollback as a GitOps desired-state change to a previous Web/API release pair. |
| [Azure Production History](azure-production.md) | Preserves the retired Static Web Apps plus Container Apps production shape as historical context only. |

## Current Delivery Boundary

The AKS Portfolio Proof Environment is the selected production-shaped verification path, not a continuously running environment. Product releases publish immutable paired Web/API GHCR images from Release Tags. An explicitly approved proof run selects reviewed image digests in the Infrastructure Repo and reconciles them through Argo CD.

Container Apps-backed Azure Production is not an active fallback. Do not reintroduce Static Web Apps deployment, Container Apps rollout scripts, production chart templates, real desired state, kubeconfigs, secrets, rendered live manifests, or Terraform roots in this product repository unless a future ADR explicitly changes the repository boundary.
