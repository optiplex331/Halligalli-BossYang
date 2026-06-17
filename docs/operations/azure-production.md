# Azure Production

Azure Production is the visible manual deployment stage for Halligalli portfolio/demo operation. It is production-shaped but non-production, and it does not imply production cutover.

Azure Production infrastructure must be applied before product deployment. Product deployment uses Release PRs, GHCR Release Images, frontend/backend application deployment, and smoke checks.

## Safety Boundary

Normal pushes and pull requests do not create Azure resources, update Container Apps, publish Static Web Apps assets, or change DNS.

Azure-mutating application deployment requires explicit human action:

1. Ensure Azure Production infrastructure has been applied.
2. Copy required frontend and smoke outputs into this repo's protected `azure-production` GitHub Environment.
3. Run `.github/workflows/azure-production.yml` with `workflow_dispatch` for frontend publication or smoke checks.
4. Run backend rollout locally with `scripts/deploy-azure-production-backend.sh vX.Y.Z` after `az login` and GHCR authentication.
5. For frontend deployment, type `AZURE_PRODUCTION_APPLY` as `confirm_cost`.

Do not commit Azure credentials, Static Web Apps deployment tokens, GitHub secrets, rendered Container Apps configs, or local `.env` files.

## Architecture

| Concern | Reference |
|---|---|
| Infrastructure | Applied separately before product deployment |
| Product deployment workflow | `.github/workflows/azure-production.yml` for frontend and smoke checks |
| Backend deployment script | `scripts/deploy-azure-production-backend.sh` |
| Frontend | Azure Static Web Apps Free at `https://play.halligalli.games` |
| Backend | Azure Container Apps Consumption at `https://api.halligalli.games`; current app name `halligalli-azprod-backend` |
| Image registry | GHCR backend Release Images, resolved to digests during backend deployment; Container Apps needs a GHCR pull credential |
| DNS | Name.com records; Azure DNS migration is out of scope |
| Runtime parameters | Protected `azure-production` GitHub Environment plus local Azure CLI login for backend rollout |

The frontend build uses `VITE_HALLIGALLI_BACKEND_URL=https://api.halligalli.games`. The backend Container App uses `HALLIGALLI_ALLOWED_ORIGINS=https://play.halligalli.games`.

`/readyz` is the Readiness Surface for traffic checks. `/health` reports Release Identity for smoke checks and rollback verification.

## Current Runtime Posture

The first external activation has been verified. Current HCP Terraform remote state has:

| Field | Current value |
|---|---|
| Frontend URL | `https://play.halligalli.games` |
| Backend URL | `https://api.halligalli.games` |
| Runtime region | `northeurope` fallback |
| Resource group location | `westeurope` |
| Backend replicas | `min=0`, `max=1` |
| Log retention | `30` days |

Before any future Terraform plan or apply, make sure the infrastructure repo's ignored local operation values match that posture unless you are intentionally changing it. For the current scaled-down environment, `AZURE_PRODUCTION_REGION` should be `northeurope` and `AZURE_PRODUCTION_BACKEND_MIN_REPLICAS` should be `0`.

## Container Image Contract

The default Dockerfile target is the Azure Container Apps backend image. It contains:

- the Node.js 24 runtime server under `dist/server/`
- shared runtime modules under `dist/src/`
- production `node_modules`
- `/readyz`, `/health`, and `/socket.io`

It intentionally does not copy Vite `dist/index.html` or `dist/assets/` into the default image. Azure Production publishes frontend assets through `deploy-frontend` to Static Web Apps; the backend image stays a socket.io backend runtime image.

Use the explicit `standalone` Docker target only for local all-in-one container checks where the same Node process should serve static frontend assets and socket.io:

```bash
docker build --target standalone -t halligalli:standalone .
```

## Local Validation

These product-side commands do not require Azure credentials:

```bash
actionlint
python3 .github/utils/validate_release_config.py
python3 -m unittest discover -s .github/utils/tests -p 'test_*.py'
pnpm run test
pnpm run typecheck
pnpm run build
```

Terraform validation belongs with the Azure Production infrastructure source.

## Deployment Operation

`Azure Production` supports:

| Operation | Behavior |
|---|---|
| `validate` | Runs release and deployment utility checks. |
| `deploy-frontend` | Builds only the Vite frontend with the secure Backend Entry and publishes `dist/` to Static Web Apps. Requires `AZURE_PRODUCTION_APPLY`. |
| `smoke-backend` | Calls `https://api.halligalli.games/readyz` and `/health` without changing resources. |

Backend deployment is local because the current Azure for Students school tenant blocks GitHub OIDC bootstrap. It accepts only `vX.Y.Z` Release Tags and uses the corresponding GHCR backend Release Image tag, such as `ghcr.io/<owner>/<repo>:0.4.0`. Before updating Container Apps, the script configures `ghcr.io` with a pull credential, resolves the tag to a digest, and deploys `ghcr.io/<owner>/<repo>@sha256:<digest>`.

```bash
az login
az account set --subscription "$AZURE_SUBSCRIPTION_ID"
gh auth status # or set AZURE_PRODUCTION_GHCR_TOKEN with read:packages scope
scripts/deploy-azure-production-backend.sh v0.4.0
```

The deployed `/health` version remains the clean Release Identity, such as `0.4.0`. Development GHCR Images are for traceability and rollback testing only; they do not feed Azure Production.

## GitHub Environment Values

Store real deployment values in this repo's protected `azure-production` GitHub Environment. Infrastructure values and Terraform state credentials must stay outside the product repo.

### Secrets

| Name | Purpose |
|---|---|
| `AZURE_STATIC_WEB_APPS_DEPLOYMENT_TOKEN` | Narrow token used only to publish frontend assets to Static Web Apps. |

### Deployment Variables

| Name | Purpose |
|---|---|
| `AZURE_PRODUCTION_FRONTEND_URL` | Public frontend URL, `https://play.halligalli.games`. |
| `AZURE_PRODUCTION_BACKEND_URL` | Public Backend Entry, `https://api.halligalli.games`. |

### Local Backend Variables

The backend deploy script has safe defaults for the current scaffold names, but it also accepts these local environment overrides:

| Name | Purpose |
|---|---|
| `AZURE_SUBSCRIPTION_ID` | Azure subscription selected before local backend rollout. |
| `AZURE_PRODUCTION_GITHUB_REPOSITORY` | GHCR repository owner/name, default `optiplex331/Halligalli-BossYang`. |
| `AZURE_PRODUCTION_GHCR_USERNAME` | Optional GHCR username; defaults to the repository owner. |
| `AZURE_PRODUCTION_GHCR_TOKEN` | Optional GHCR token with `read:packages`; falls back to `GHCR_TOKEN`, `GITHUB_TOKEN`, or `gh auth token`. |
| `AZURE_PRODUCTION_RESOURCE_GROUP_NAME` | Resource group containing the Container App. |
| `AZURE_PRODUCTION_CONTAINER_APP_NAME` | Container App backend name. |
| `AZURE_PRODUCTION_FRONTEND_URL` | Allowed browser origin, default `https://play.halligalli.games`. |
| `AZURE_PRODUCTION_BACKEND_URL` | Backend Entry used for smoke checks, default `https://api.halligalli.games`. |

## Name.com DNS And Custom Domains

`halligalli.games` remains on Name.com nameservers. Do not migrate DNS authority to Azure DNS for this Azure Production stage.

Infrastructure outputs and Azure portal values provide the current Static Web Apps default hostname, Container Apps ingress hostname, and Container Apps domain verification ID. Name.com verification and routing records remain manual.

Current activation records are:

| Type | Name | Value |
|---|---|---|
| `CNAME` | `play` | `thankful-mushroom-06afe9003.7.azurestaticapps.net` |
| `CNAME` | `api` | `halligalli-azprod-backend.livelysand-8b8a433d.northeurope.azurecontainerapps.io` |
| `TXT` | `asuid.api` | Container Apps custom-domain verification ID from Azure. |

Destroying Azure resources does not remove Name.com records; clean them up manually when tearing Azure Production down.

## First Activation

Use this order when activating Azure Production:

1. Apply infrastructure. Use `AZURE_PRODUCTION_REGION=northeurope` only when `westeurope` Container Apps capacity blocks activation.
2. Copy required frontend and smoke values into this repo's `azure-production` GitHub Environment.
3. Add required Name.com CNAME/TXT records from Terraform outputs and Azure Container Apps custom-domain verification.
4. Complete Container Apps custom-domain/certificate activation for `api.halligalli.games`.
5. Run `scripts/deploy-azure-production-backend.sh vX.Y.Z` locally after the GHCR backend Release Image for that tag exists and a GHCR pull credential is available.
6. Run `operation=deploy-frontend` with `confirm_cost=AZURE_PRODUCTION_APPLY`.
7. Run `operation=smoke-backend`, then verify the public frontend, `/readyz`, `/health`, and socket.io multiplayer path over WSS.

## Cost And Lifecycle

Use the infrastructure `scale-down` operation when Azure Production does not need to serve demos. It keeps Static Web Apps, DNS, Log Analytics, and custom-domain bindings, while setting the backend to a zero-minimum-replica posture. Use `destroy` only when intentionally tearing down Azure-managed resources.
