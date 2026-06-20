# Azure Production History

Azure Production was the historical Container Apps-backed deployment stage for Halligalli portfolio/demo operation. After the AKS cutover and historical destroy operation, its Terraform-managed resources are gone and it is not an active fallback.

The active production path is Azure Kubernetes Production. This document preserves the old Static Web Apps plus Container Apps architecture as teaching material only; it is not an operation checklist.

## Historical Shape

| Concern | Historical value |
|---|---|
| Frontend | Azure Static Web Apps Free at `https://play.halligalli.games` |
| Backend | Azure Container Apps Consumption at `https://api.halligalli.games`; app name was `halligalli-azprod-backend` |
| Infrastructure | Historical Container Apps-backed Terraform root in the infrastructure repo |
| Runtime image | Historical backend-only GHCR Release Images selected by digest |
| DNS | Name.com CNAME/TXT records, not Azure DNS |
| Runtime split | Static frontend used `VITE_HALLIGALLI_BACKEND_URL=https://api.halligalli.games`; backend allowed `https://play.halligalli.games` |

The old backend image intentionally did not copy Vite `dist/index.html` or `dist/assets/`. Static Web Apps served frontend assets, while Container Apps served `/readyz`, `/health`, and socket.io.

## Why It Was Superseded

Azure Kubernetes Production replaced this split-origin shape with one same-origin standalone runtime:

```text
https://play.halligalli.games -> AKS ingress -> standalone Halligalli container
```

The AKS path removes the separate Backend Entry, avoids `VITE_HALLIGALLI_BACKEND_URL`, and keeps active rollout review in the infrastructure repo's digest-pinned GitOps desired state.

## Historical Proof Context

The first external activation was verified before the AKS cutover. The later historical destroy operation removed the Terraform-managed Azure Production resources.

| Field | Last known historical value |
|---|---|
| Frontend URL | `https://play.halligalli.games` |
| Backend URL | `https://api.halligalli.games` |
| Runtime region | `northeurope` fallback |
| Resource group location | `westeurope` |
| Backend replicas | `min=0`, `max=1` |
| Log retention | `30` days |

Historical DNS records retained for audit were:

| Type | Name | Historical purpose |
|---|---|---|
| `CNAME` | `play` | Routed the old frontend host to Azure Static Web Apps |
| `CNAME` | `api` | Routed the old Backend Entry to Azure Container Apps |
| `TXT` | `asuid.api` | Proved Container Apps custom-domain ownership |

## Current Boundary

Do not use the old Static Web Apps or Container Apps path for new production deployment, smoke checks, or rollback. The executable workflow and local backend rollout script have been removed from this product repo.

Use the infrastructure repo's Azure Kubernetes Production runbook for active production operations. Application rollback is a GitOps desired-state change to a reviewed standalone GHCR image digest, not a Container Apps redeploy.
