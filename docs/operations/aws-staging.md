# AWS Staging Scaffold

AWS Staging/Portfolio is a reviewable Stage 2 scaffold, not a live production environment and not a cutover from DigitalOcean. DO Production remains the active production path through Release PR, Production Promotion, `deploy/production/app.yaml`, and the GitOps Reconciler.

## Safety Boundary

The scaffold is safe to review because normal pushes and pull requests do not create AWS resources, push ECR images, update ECS, publish frontend assets, change DNS, or alter DO Production.

AWS-mutating work requires an explicit human action:

1. Configure Terraform Cloud, AWS credentials, Route 53, certificates, and GitHub environment values.
2. Run Terraform plan/apply deliberately from `deploy/aws-staging/`.
3. Run `.github/workflows/aws-staging.yml` with `workflow_dispatch`.
4. For deploy operations, type `STAGING_APPLY` into the `confirm_cost` input.

Do not commit Terraform state, `.tfvars`, AWS credentials, GitHub secrets, rendered task definitions, or local `.env` files.

## Architecture

| Concern | Scaffold |
|---|---|
| Region | `eu-west-1` |
| Domain | `halligalli.games` |
| Frontend | Vite static assets in S3 behind CloudFront at `play.halligalli.games` |
| Backend | Node.js 24/socket.io container in ECR and ECS Fargate behind an ALB at `api.halligalli.games` |
| DNS | Route 53 records for staging subdomains; domain registration stays with Name.com |
| State | Terraform Cloud workspace `halligalli-aws-staging` |
| Production | Unchanged DO Production using GHCR Release Images |

The frontend build uses:

```text
VITE_HALLIGALLI_BACKEND_URL=https://api.halligalli.games
```

The backend task uses:

```text
HALLIGALLI_ALLOWED_ORIGINS=https://play.halligalli.games
```

`/readyz` is the Readiness Surface for traffic checks. `/health` still reports Release Identity for smoke and drift checks.

## Local Validation

These commands do not require AWS credentials or Terraform Cloud credentials:

```bash
terraform -chdir=deploy/aws-staging fmt -check -recursive
terraform -chdir=deploy/aws-staging init -backend=false -input=false
terraform -chdir=deploy/aws-staging validate -no-color
docker run --rm -v "${PWD}:/repo" --workdir /repo rhysd/actionlint:1.7.12 -color
pnpm run test
pnpm run typecheck
pnpm run build
```

Do not use `terraform apply` as a validation shortcut.

## GitHub Configuration

Future manual deploys use the `aws-staging` GitHub environment.

| Type | Name | Purpose |
|---|---|---|
| Secret | `AWS_STAGING_ACCESS_KEY_ID` | AWS identity for manual staging deploys. |
| Secret | `AWS_STAGING_SECRET_ACCESS_KEY` | AWS secret for manual staging deploys. |
| Variable | `AWS_STAGING_FRONTEND_BUCKET` | S3 bucket created by Terraform for frontend assets. |
| Variable | `AWS_STAGING_CLOUDFRONT_DISTRIBUTION_ID` | CloudFront distribution to invalidate after frontend sync. |
| Variable | `AWS_STAGING_ECR_REGISTRY` | ECR registry host, for example `<account>.dkr.ecr.eu-west-1.amazonaws.com`. |
| Variable | `AWS_STAGING_ECR_REPOSITORY` | ECR repository name for the staging backend image. |
| Variable | `AWS_STAGING_ECS_CLUSTER` | ECS cluster name. |
| Variable | `AWS_STAGING_ECS_SERVICE` | ECS service name. |
| Variable | `AWS_STAGING_TASK_FAMILY` | ECS task definition family. |
| Variable | `AWS_STAGING_CONTAINER_NAME` | ECS container name, currently `backend`. |

Store real values only in GitHub or Terraform Cloud, never in Git.

## Manual Workflow

`AWS Staging Scaffold` supports these manual operations:

| Operation | Behavior |
|---|---|
| `validate` | Runs release config validation and Terraform static validation only. |
| `deploy-frontend` | Builds with `VITE_HALLIGALLI_BACKEND_URL`, syncs static assets to S3, and invalidates CloudFront. Requires `STAGING_APPLY`. |
| `deploy-backend` | Builds and pushes an ECR image, updates ECS to a new task definition revision, waits for stability, then checks `/readyz` and `/health`. Requires `STAGING_APPLY`. |
| `smoke-backend` | Checks `/readyz` and `/health` against the configured backend URL. |

Normal CI/CD required checks remain `Product checks` and `Container build and scan`. AWS staging infrastructure changes are classified as Delivery Control, so the PR still reports stable required checks without deploying AWS resources.

## Cost And Lifecycle

The intended lifecycle is demo-oriented:

1. Apply or scale up only when preparing a portfolio demo.
2. Demo the frontend, backend, `/readyz`, `/health`, and socket.io multiplayer path.
3. Destroy or scale down afterward.

Cost risks to watch:

- ALB hourly charges.
- Public IPv4 charges for public load balancer and Fargate task networking.
- Fargate task runtime while `backend_desired_count = 1`.
- CloudFront/S3 request and transfer costs.
- CloudWatch Logs ingestion and retention.
- NAT Gateway is intentionally not part of the default scaffold; do not add it without a separate cost decision.

For teardown, prefer Terraform-managed destroy for temporary demo infrastructure. If keeping the stack, set the backend desired count to `0` when not showing it and keep CloudWatch retention short.
