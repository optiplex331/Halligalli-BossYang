# Azure Production Scaffold Reference

This Terraform root is the active cloud scaffold target for Halligalli. It models a production-shaped but non-production Azure environment without committing real account-specific configuration or creating Azure resources during normal PR validation.

Real Azure subscription IDs, Microsoft Entra app IDs, HCP Terraform tokens, Static Web Apps deployment tokens, generated backend config, generated tfvars, Terraform state, plans, and local environment files are excluded from Git.

## Resource Shape

- Frontend: Azure Static Web Apps Free for `play.halligalli.games`.
- Backend: Azure Container Apps Consumption for the independent secure Backend Entry at `api.halligalli.games`.
- Images: digest-pinned GHCR Release Images deployed directly to Azure Container Apps.
- Logs: Log Analytics with seven-day retention.
- Identity: Microsoft Entra workload identity federation from GitHub Actions. The Terraform execution identity is bootstrapped once outside this root.
- DNS: Name.com remains the DNS authority. Azure DNS is not part of this scaffold.
- Cost posture: backend can scale to zero minimum replicas, maximum replicas stay fixed at one, no Front Door, no AKS, no database.

The committed defaults are safe placeholders except for the public Halligalli scaffold hostnames. Override real account values through the protected `azure-production-scaffold` GitHub Environment.

## Private Runtime Config

The public repo keeps only examples:

- `terraform.tfvars.example` shows the Terraform value shape.
- `backend.hcl.example` shows the HCP Terraform remote-state backend shape.
- `github-environment.example` lists GitHub Environment keys without real values.

The operating path is the manual `Azure Production Scaffold Infrastructure` workflow. It reads private values from the `azure-production-scaffold` GitHub Environment, writes temporary `backend.hcl` and `terraform.auto.tfvars.json` files under the runner temp directory, and runs Terraform CLI on the GitHub Actions runner.

HCP Terraform stores remote state and state versions. It does not execute Terraform runs for this project phase.

## Static Validation

These commands do not require Azure credentials or HCP Terraform access:

```bash
terraform -chdir=deploy/azure fmt -check -recursive
terraform -chdir=deploy/azure init -backend=false -input=false
terraform -chdir=deploy/azure validate -no-color
```

If formatting changes are needed:

```bash
terraform -chdir=deploy/azure fmt -recursive
```

Do not run `terraform apply` as a validation shortcut. A real apply creates cost-bearing Azure resources and should happen only through the protected infrastructure workflow after reviewing the plan, state workspace, workload identity, DNS ownership, custom-domain setup, and lifecycle posture.

## Operating A Real Environment

Use `.github/workflows/azure-production-scaffold-infra.yml`:

- `plan` reads HCP remote state and Azure account state without changing resources.
- `apply` creates or changes infrastructure after protected approval and `AZURE_PRODUCTION_APPLY`.
- `scale-down` applies the same root with `backend_min_replicas=0` after `AZURE_PRODUCTION_SCALE_DOWN`.
- `destroy` runs Terraform destroy after protected approval and `AZURE_PRODUCTION_DESTROY`.

Use `.github/workflows/azure-production-scaffold.yml` for application deployment:

- `deploy-backend` resolves the selected `vX.Y.Z` GHCR Release Image to a digest, updates Container Apps, and checks `/readyz` and `/health`.
- `deploy-frontend` builds the Vite frontend with `VITE_HALLIGALLI_BACKEND_URL=https://api.halligalli.games` and publishes static assets to Static Web Apps with the protected deployment token.
- `smoke-backend` checks the secure Backend Entry without changing resources.

## Public Boundary

Tracked files in this root are the Terraform architecture, variable definitions, examples, and documentation. Ignored files include generated local environment configuration, backend config, `.terraform/`, state, plan files, and tfvars.
