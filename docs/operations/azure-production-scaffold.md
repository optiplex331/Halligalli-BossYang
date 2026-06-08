# Azure Production Scaffold Reference

Azure Production Scaffold is a production-shaped Azure environment for Halligalli portfolio/demo operation. It is the active cloud scaffold target, but it is not a production cutover. The current Release PR and GHCR image identity path remains separate.

The public repository contains the reviewable Terraform shape, manual workflow wiring, and GitHub Environment value template. It does not contain real Azure subscription values, HCP Terraform tokens, Static Web Apps deployment tokens, generated tfvars, Terraform state, Terraform plans, Microsoft Entra credentials, Name.com account access, or local `.env` files.

## Safety Boundary

Normal pushes and pull requests do not create Azure resources, update Container Apps, publish Static Web Apps assets, or change DNS.

Azure-mutating work requires explicit human action:

1. Bootstrap the Azure Production Scaffold Terraform execution identity and GitHub federated credential once outside this Terraform root.
2. Configure the protected `azure-production-scaffold` GitHub Environment with HCP, Azure, Static Web Apps, Container Apps, domain, and runtime values.
3. Run `.github/workflows/azure-production-scaffold-infra.yml` with `workflow_dispatch`.
4. For mutating infrastructure operations, type the required confirmation: `AZURE_PRODUCTION_APPLY`, `AZURE_PRODUCTION_SCALE_DOWN`, or `AZURE_PRODUCTION_DESTROY`.
5. Run `.github/workflows/azure-production-scaffold.yml` separately for frontend/backend application deployment.

Do not commit Terraform state, `.tfvars`, generated backend config, Terraform plans, Azure credentials, Static Web Apps deployment tokens, GitHub secrets, rendered Container Apps configs, or local `.env` files. Do not upload those files as workflow artifacts or cache entries.

## Architecture

| Concern | Reference |
|---|---|
| Region | `westeurope`, with `northeurope` only as an operational fallback |
| Domain | `halligalli.games`; apex remains outside this scaffold decision |
| Frontend | Azure Static Web Apps Free at `https://play.halligalli.games` |
| Backend | Azure Container Apps Consumption at `https://api.halligalli.games` |
| Image registry | GHCR Release Images, resolved to digests during backend deployment |
| Logs | Log Analytics with seven-day retention |
| DNS | Name.com records; Azure DNS migration is out of scope |
| State | HCP Terraform remote state; Terraform CLI runs on GitHub Actions |
| Runtime parameters | Protected `azure-production-scaffold` GitHub Environment |

The frontend build uses `VITE_HALLIGALLI_BACKEND_URL=https://api.halligalli.games`. The backend Container App uses `HALLIGALLI_ALLOWED_ORIGINS=https://play.halligalli.games`.

`/readyz` is the Readiness Surface for traffic checks. `/health` reports Release Identity for smoke checks and rollback verification.

## Local Validation

These commands do not require Azure credentials or HCP Terraform access:

```bash
terraform -chdir=deploy/azure fmt -check -recursive
terraform -chdir=deploy/azure init -backend=false -input=false
terraform -chdir=deploy/azure validate -no-color
actionlint
python3 .github/utils/validate_release_config.py
python3 -m unittest discover -s .github/utils/tests -p 'test_*.py'
pnpm run test
pnpm run typecheck
pnpm run build
```

Do not use `terraform apply` as a validation shortcut.

## Infrastructure Operation

`Azure Production Scaffold Infrastructure` supports these manual operations:

| Operation | Behavior |
|---|---|
| `plan` | Generates a real Terraform plan from GitHub Environment values, Azure account state, and HCP Terraform remote state. |
| `apply` | Generates a fresh saved plan and applies it in the same workflow run. Requires `AZURE_PRODUCTION_APPLY`. |
| `scale-down` | Generates a fresh saved plan with `backend_min_replicas=0` and applies it. Requires `AZURE_PRODUCTION_SCALE_DOWN`. |
| `destroy` | Generates a fresh destroy plan and applies it. Requires `AZURE_PRODUCTION_DESTROY`. |

The workflow runs Terraform CLI on the GitHub Actions runner. HCP Terraform stores remote state and state versions; it does not execute Terraform runs for this project phase.

The workflow generates private files under the runner temp directory:

- `backend.hcl`
- `terraform.auto.tfvars.json`
- `tfplan`

These files are not committed, cached, or uploaded as artifacts.

## Deployment Operation

`Azure Production Scaffold` supports:

| Operation | Behavior |
|---|---|
| `validate` | Runs release utility checks and static Terraform validation. |
| `deploy-frontend` | Builds the Vite frontend with the secure Backend Entry and publishes `dist/` to Static Web Apps. Requires `AZURE_PRODUCTION_APPLY`. |
| `deploy-backend` | Resolves the selected `vX.Y.Z` GHCR Release Image to a digest, updates Container Apps, and smoke checks `/readyz` and `/health`. Requires `AZURE_PRODUCTION_APPLY`. |
| `smoke-backend` | Calls `https://api.halligalli.games/readyz` and `/health` without changing resources. |

Backend deployment accepts only `vX.Y.Z` Release Tags and uses the corresponding GHCR Release Image tag, such as `ghcr.io/<owner>/<repo>:0.4.0`. Before updating Container Apps, the workflow configures `ghcr.io` as the registry server, resolves the tag to a digest, and deploys `ghcr.io/<owner>/<repo>@sha256:<digest>`.

The deployed `/health` version remains the clean Release Identity, such as `0.4.0`. Development GHCR Images are still for traceability and rollback testing only; they do not feed Azure Production Scaffold. The GHCR Release Image must be pullable by Azure Container Apps; private GHCR credentials are out of scope for this scaffold decision.

## GitHub Environment Values

Store real values in the `azure-production-scaffold` GitHub Environment. Use `deploy/azure/github-environment.example` as the key template.

### Secrets

| Name | Purpose |
|---|---|
| `HCP_TERRAFORM_TOKEN` | Terraform CLI credential for HCP Terraform remote state. |
| `AZURE_STATIC_WEB_APPS_DEPLOYMENT_TOKEN` | Narrow token used only to publish frontend assets to Static Web Apps. |

### Identity Variables

| Name | Purpose |
|---|---|
| `AZURE_TENANT_ID` | Microsoft Entra tenant for workload identity federation. |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription containing scaffold resources. |
| `AZURE_TERRAFORM_CLIENT_ID` | Federated client ID used by Terraform infrastructure operations. |
| `AZURE_DEPLOY_CLIENT_ID` | Federated client ID used by backend deployment operations. |
| `AZURE_DEPLOY_PRINCIPAL_ID` | Object ID Terraform can grant Container Apps update permissions to. |

### Infrastructure Variables

| Name | Purpose |
|---|---|
| `HCP_TERRAFORM_ORGANIZATION` | HCP Terraform organization for generated backend config. |
| `HCP_TERRAFORM_WORKSPACE` | HCP Terraform workspace for remote state. |
| `HCP_TERRAFORM_WORKSPACE_URL` | GitHub Environment URL target for infrastructure runs. |
| `AZURE_PRODUCTION_PROJECT_NAME` | Optional project-name override; defaults to `halligalli`. |
| `AZURE_PRODUCTION_REGION` | Runtime region; default `westeurope`, fallback `northeurope`. |
| `AZURE_PRODUCTION_STATIC_WEB_APP_LOCATION` | Static Web Apps location. |
| `AZURE_PRODUCTION_DOMAIN_NAME` | Scaffold domain, currently `halligalli.games`. |
| `AZURE_PRODUCTION_FRONTEND_SUBDOMAIN` | Frontend subdomain, currently `play`. |
| `AZURE_PRODUCTION_BACKEND_SUBDOMAIN` | Backend subdomain, currently `api`. |
| `AZURE_PRODUCTION_RESOURCE_GROUP_NAME` | Azure scaffold resource group. |
| `AZURE_PRODUCTION_STATIC_WEB_APP_NAME` | Static Web App name. |
| `AZURE_PRODUCTION_BACKEND_IMAGE` | Bootstrap image for the Terraform-managed Container App. |
| `AZURE_PRODUCTION_BACKEND_MIN_REPLICAS` | `0` for bootstrap or scale down, `1` to serve traffic. |
| `AZURE_PRODUCTION_BACKEND_MAX_REPLICAS` | Must remain `1`. |
| `AZURE_PRODUCTION_BACKEND_APP_VERSION` | Optional baseline Release Identity in the Terraform-managed Container App. |
| `AZURE_PRODUCTION_BACKEND_COMMIT_SHA` | Optional baseline commit SHA in the Terraform-managed Container App. |
| `AZURE_PRODUCTION_GITHUB_REPOSITORY` | GitHub owner/repository expected to operate scaffold workflows. |

### Deployment Variables

| Name | Purpose |
|---|---|
| `AZURE_PRODUCTION_FRONTEND_URL` | Public frontend URL, `https://play.halligalli.games`. |
| `AZURE_PRODUCTION_BACKEND_URL` | Public Backend Entry, `https://api.halligalli.games`. |
| `AZURE_PRODUCTION_RESOURCE_GROUP_NAME` | Resource group containing the Container App. |
| `AZURE_PRODUCTION_STATIC_WEB_APP_NAME` | Static Web App name. |
| `AZURE_PRODUCTION_CONTAINER_APP_NAME` | Container App backend name. |

## Name.com DNS And Custom Domains

`halligalli.games` remains on Name.com nameservers. Do not migrate DNS authority to Azure DNS for this scaffold.

Terraform manages the Static Web Apps custom-domain binding and outputs the Container Apps ingress hostname. The `api.halligalli.games` Container Apps custom-domain/certificate activation is an external activation step in Azure, followed by the required Name.com verification and routing records.

Configure or confirm these records during activation:

| Hostname | Record | Value |
|---|---|---|
| `play.halligalli.games` | CNAME | Static Web Apps default hostname from Terraform output or Azure portal. |
| Static Web Apps verification host | TXT or CNAME | Exact verification record shown by Azure during custom-domain validation. |
| `api.halligalli.games` | CNAME | Container Apps ingress hostname from Terraform output or Azure portal. |
| Container Apps verification host | TXT | Exact `asuid` verification record shown by Azure during custom-domain validation. |

Add only the records Azure requests for the current resources. Destroying Azure resources does not remove Name.com records; clean them up manually when tearing the scaffold down.

## First Activation

Use this order when activating Azure Production Scaffold:

1. Bootstrap the Terraform execution identity and GitHub federated credential outside this Terraform root.
2. Configure the `azure-production-scaffold` GitHub Environment values listed above.
3. Run `Azure Production Scaffold Infrastructure` with `operation=plan`.
4. Review the cost-bearing resources: Static Web Apps, Log Analytics, Container Apps environment, Container App, and role assignments.
5. Run `operation=apply` with `confirm=AZURE_PRODUCTION_APPLY`, using `backend_min_replicas=0` and the placeholder backend image so Terraform can create the base infrastructure.
6. Copy Terraform outputs into the GitHub Environment variables used by the deployment workflow.
7. Complete Container Apps custom-domain/certificate activation for `api.halligalli.games`, then add required custom-domain verification and routing records in Name.com.
8. Run `Azure Production Scaffold` with `operation=deploy-backend` and `confirm_cost=AZURE_PRODUCTION_APPLY` from a Release Tag after the GHCR Release Image for that tag exists and is public to Azure Container Apps.
9. Run `operation=deploy-frontend` with `confirm_cost=AZURE_PRODUCTION_APPLY`.
10. Run `operation=smoke-backend`, then verify the public frontend, `/readyz`, `/health`, and socket.io multiplayer path over WSS.

## Cost And Lifecycle

Use `scale-down` when Azure Production Scaffold does not need to serve demos. It preserves Static Web Apps, Log Analytics, existing custom-domain bindings, Name.com records, and Terraform state while setting backend minimum replicas to zero.

Use `destroy` only when intentionally tearing down Azure-managed scaffold resources. After destroy, manually remove stale Name.com DNS records and GitHub Environment values that should no longer be used.
