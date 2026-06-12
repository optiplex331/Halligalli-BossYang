# Azure Production

Azure Production is the visible manual deployment stage for Halligalli portfolio/demo operation. It is production-shaped but non-production, and it does not imply production cutover.

Infrastructure source of truth now lives in the private `optiplex331/Halligalli-infra` repository. This product repo owns Release PRs, GHCR Release Images, frontend/backend application deployment, and smoke checks.

## Safety Boundary

Normal pushes and pull requests do not create Azure resources, update Container Apps, publish Static Web Apps assets, or change DNS.

Azure-mutating application deployment requires explicit human action:

1. Ensure Azure Production infrastructure has been applied from `optiplex331/Halligalli-infra`.
2. Copy required infrastructure outputs into this repo's protected `azure-production` GitHub Environment.
3. Run `.github/workflows/azure-production.yml` with `workflow_dispatch`.
4. For frontend or backend deployment, type `AZURE_PRODUCTION_APPLY` as `confirm_cost`.

Do not commit Azure credentials, Static Web Apps deployment tokens, GitHub secrets, rendered Container Apps configs, or local `.env` files.

## Architecture

| Concern | Reference |
|---|---|
| Infrastructure repo | `optiplex331/Halligalli-infra` |
| Product deployment workflow | `.github/workflows/azure-production.yml` |
| Frontend | Azure Static Web Apps Free at `https://play.halligalli.games` |
| Backend | Azure Container Apps Consumption at `https://api.halligalli.games` |
| Image registry | GHCR backend Release Images, resolved to digests during backend deployment |
| DNS | Name.com records; Azure DNS migration is out of scope |
| Runtime parameters | Protected `azure-production` GitHub Environment |

The frontend build uses `VITE_HALLIGALLI_BACKEND_URL=https://api.halligalli.games`. The backend Container App uses `HALLIGALLI_ALLOWED_ORIGINS=https://play.halligalli.games`.

`/readyz` is the Readiness Surface for traffic checks. `/health` reports Release Identity for smoke checks and rollback verification.

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

Terraform validation belongs in `optiplex331/Halligalli-infra`.

## Deployment Operation

`Azure Production` supports:

| Operation | Behavior |
|---|---|
| `validate` | Runs release and deployment utility checks. |
| `deploy-frontend` | Builds only the Vite frontend with the secure Backend Entry and publishes `dist/` to Static Web Apps. Requires `AZURE_PRODUCTION_APPLY`. |
| `deploy-backend` | Resolves the selected `vX.Y.Z` GHCR backend Release Image to a digest, updates Container Apps, and smoke checks `/readyz` and `/health`. Requires `AZURE_PRODUCTION_APPLY`. |
| `smoke-backend` | Calls `https://api.halligalli.games/readyz` and `/health` without changing resources. |

Backend deployment accepts only `vX.Y.Z` Release Tags and uses the corresponding GHCR backend Release Image tag, such as `ghcr.io/<owner>/<repo>:0.4.0`. Before updating Container Apps, the workflow configures `ghcr.io` as the registry server, resolves the tag to a digest, and deploys `ghcr.io/<owner>/<repo>@sha256:<digest>`.

The deployed `/health` version remains the clean Release Identity, such as `0.4.0`. Development GHCR Images are for traceability and rollback testing only; they do not feed Azure Production.

## GitHub Environment Values

Store real deployment values in this repo's protected `azure-production` GitHub Environment. Infrastructure values and Terraform state credentials belong in `optiplex331/Halligalli-infra`.

### Secrets

| Name | Purpose |
|---|---|
| `AZURE_STATIC_WEB_APPS_DEPLOYMENT_TOKEN` | Narrow token used only to publish frontend assets to Static Web Apps. |

### Deployment Variables

| Name | Purpose |
|---|---|
| `AZURE_TENANT_ID` | Microsoft Entra tenant for workload identity federation. |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription containing Azure-managed resources. |
| `AZURE_DEPLOY_CLIENT_ID` | Federated client ID used by backend deployment operations. |
| `AZURE_PRODUCTION_FRONTEND_URL` | Public frontend URL, `https://play.halligalli.games`. |
| `AZURE_PRODUCTION_BACKEND_URL` | Public Backend Entry, `https://api.halligalli.games`. |
| `AZURE_PRODUCTION_RESOURCE_GROUP_NAME` | Resource group containing the Container App. |
| `AZURE_PRODUCTION_CONTAINER_APP_NAME` | Container App backend name. |

## Name.com DNS And Custom Domains

`halligalli.games` remains on Name.com nameservers. Do not migrate DNS authority to Azure DNS for this Azure Production stage.

Infrastructure outputs and Azure portal values from `optiplex331/Halligalli-infra` provide the current Static Web Apps default hostname and Container Apps ingress hostname. Name.com verification and routing records remain manual.

Destroying Azure resources does not remove Name.com records; clean them up manually when tearing Azure Production down.

## First Activation

Use this order when activating Azure Production:

1. Apply infrastructure from `optiplex331/Halligalli-infra`.
2. Copy required deployment values into this repo's `azure-production` GitHub Environment.
3. Complete Container Apps custom-domain/certificate activation for `api.halligalli.games`, then add required custom-domain verification and routing records in Name.com.
4. Run `Azure Production` with `operation=deploy-backend` and `confirm_cost=AZURE_PRODUCTION_APPLY` from a Release Tag after the GHCR backend Release Image for that tag exists and is pullable by Azure Container Apps.
5. Run `operation=deploy-frontend` with `confirm_cost=AZURE_PRODUCTION_APPLY`.
6. Run `operation=smoke-backend`, then verify the public frontend, `/readyz`, `/health`, and socket.io multiplayer path over WSS.

## Cost And Lifecycle

Use the infrastructure repo's `scale-down` operation when Azure Production does not need to serve demos. Use `destroy` only when intentionally tearing down Azure-managed resources.
