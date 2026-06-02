# AWS Staging Scaffold

AWS Staging/Portfolio is a reviewable Stage 2 scaffold, not a live production environment and not a cutover from DigitalOcean. DO Production remains the active production path through Release PR, Production Promotion, `deploy/production/app.yaml`, and the GitOps Reconciler.

## Safety Boundary

The scaffold is safe to review because normal pushes and pull requests do not create AWS resources, push ECR images, update ECS, publish frontend assets, change DNS, or alter DO Production.

AWS-mutating work requires an explicit human action:

1. Configure Terraform Cloud, GitHub OIDC to AWS, Route 53, certificates, and GitHub environment values.
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

## Stage 2.1 Activation Runbook

Use this order when turning the scaffold into a live AWS Staging/Portfolio environment. Do not skip the bootstrap sequence: the first ECS service cannot run a real task until the ECR repository exists and contains an image.

1. Create or confirm the Terraform Cloud workspace `halligalli-aws-staging`.
2. Configure the Terraform Cloud variables listed below.
3. Let Terraform create the GitHub OIDC deploy role, or provide an existing GitHub OIDC provider ARN through `github_oidc_provider_arn`.
4. Run Terraform plan from `deploy/aws-staging/` and review the cost-bearing resources.
5. Apply with `backend_desired_count=0` and a placeholder `backend_image_tag` so Terraform can create the base infrastructure and ECR repository without requiring a runnable backend task.
6. Copy Terraform outputs into the GitHub `aws-staging` environment variables listed below.
7. Push a seed backend image to the ECR repository. Use a one-off operator push during first activation, then use the workflow for normal backend deployments after the service can pass smoke checks.
8. Re-run Terraform with `backend_image_tag` matching the seed image tag and `backend_desired_count=1`, or leave desired count at `0` until a demo window.
9. Run the `AWS Staging Scaffold` workflow with `operation=deploy-backend` and `confirm_cost=STAGING_APPLY` to prove workflow-driven backend deployment and release identity checks.
10. Run `operation=deploy-frontend` with `confirm_cost=STAGING_APPLY`.
11. Run `operation=smoke-backend`, then verify the public frontend, `/readyz`, `/health`, and socket.io multiplayer path.

If the environment is only being prepared for a short portfolio demo, keep `backend_desired_count=0` outside the demo window and scale up deliberately.

## Terraform Cloud Configuration

Terraform Cloud stores values that affect infrastructure shape. Keep them in the `halligalli-aws-staging` workspace, not in Git.

| Variable | Category | Required for live apply | Purpose |
|---|---|---|---|
| `route53_zone_id` | Terraform variable | Yes | Hosted zone ID for `halligalli.games`, used for CloudFront certificate validation and `play.halligalli.games` / `api.halligalli.games` aliases. |
| `frontend_cloudfront_enabled` | Terraform variable | Yes | Enables the CloudFront distribution after the frontend slice is ready to serve traffic. |
| `backend_certificate_arn` | Terraform variable | Yes | ACM certificate ARN in `eu-west-1` for the backend ALB listener at `api.halligalli.games`. |
| `backend_image_tag` | Terraform variable | Yes | ECR image tag expected by the ECS task definition. Use a placeholder for the first `desired_count=0` bootstrap apply, then the real staging tag after the first image push. |
| `backend_desired_count` | Terraform variable | Yes | `0` for bootstrap/teardown, `1` for demos. Values above `1` are intentionally out of scope. |
| `github_repository` | Terraform variable | Optional | GitHub owner/repository allowed to assume the deploy role. Defaults to `optiplex331/Halligalli-BossYang`. |
| `github_oidc_provider_arn` | Terraform variable | Optional | Existing GitHub OIDC provider ARN. Leave null for this root to create the provider. |
| `github_oidc_thumbprint_list` | Terraform variable | Optional | GitHub OIDC provider thumbprints used only when this root creates the provider. |
| `github_oidc_subjects` | Terraform variable | Optional | Allowed GitHub OIDC `sub` claims. Defaults to the `aws-staging` GitHub environment. |
| `backend_app_version` | Terraform variable | Optional | Placeholder Release Identity in the Terraform-managed task definition; the deploy workflow injects the real image version when updating ECS. |
| `backend_commit_sha` | Terraform variable | Optional | Placeholder commit SHA in the Terraform-managed task definition; the deploy workflow injects the real commit when updating ECS. |
| `backend_task_cpu` | Terraform variable | Optional | Small Fargate CPU size for staging demos. |
| `backend_task_memory` | Terraform variable | Optional | Small Fargate memory size for staging demos. |

The existing defaults keep `project_name`, `aws_region`, `domain_name`, `frontend_subdomain`, `backend_subdomain`, and `enable_nat_gateway` fixed to the accepted scaffold boundary. Do not override those without a separate architecture decision.

Terraform owns the baseline ECS task definition, but normal AWS Staging image rollout is workflow-owned. The ECS service ignores `task_definition` drift so a later Terraform apply does not roll the service back from a workflow-deployed image revision.

## GitHub Configuration

Future manual deploys use the `aws-staging` GitHub environment.

| Type | Name | Purpose |
|---|---|---|
| Variable | `AWS_STAGING_ROLE_ARN` | IAM role assumed by GitHub Actions through OIDC for manual staging deploys. |
| Variable | `AWS_STAGING_FRONTEND_BUCKET` | S3 bucket created by Terraform for frontend assets. |
| Variable | `AWS_STAGING_CLOUDFRONT_DISTRIBUTION_ID` | CloudFront distribution to invalidate after frontend sync. |
| Variable | `AWS_STAGING_ECR_REGISTRY` | ECR registry host, for example `<account>.dkr.ecr.eu-west-1.amazonaws.com`. |
| Variable | `AWS_STAGING_ECR_REPOSITORY` | ECR repository name for the staging backend image. |
| Variable | `AWS_STAGING_ECS_CLUSTER` | ECS cluster name. |
| Variable | `AWS_STAGING_ECS_SERVICE` | ECS service name. |
| Variable | `AWS_STAGING_TASK_FAMILY` | ECS task definition family. |
| Variable | `AWS_STAGING_CONTAINER_NAME` | ECS container name, currently `backend`. |

The live activation path uses `aws-actions/configure-aws-credentials` to assume `AWS_STAGING_ROLE_ARN` through GitHub OIDC. Do not reintroduce long-lived `AWS_STAGING_ACCESS_KEY_ID` or `AWS_STAGING_SECRET_ACCESS_KEY` secrets for staging deploys. OIDC requires `id-token: write`; keep that permission scoped to staging deployment automation.

Store real values only in GitHub or Terraform Cloud, never in Git.

## GitHub OIDC Requirements

The AWS IAM role for staging deploys should trust only this repository and the `aws-staging` GitHub environment. The trust boundary should be scoped to `repo:<owner>/<repo>:environment:aws-staging`, not every branch or workflow in the repository.

Use a permission policy scoped to the deploy behavior:

- S3 object sync for the frontend asset bucket.
- CloudFront invalidation for the staging distribution.
- ECR login, image layer upload, and image push for the staging backend repository.
- ECS task definition read/register, service update, and service stability checks for the staging cluster/service.
- IAM `PassRole` only for the ECS task execution/task roles created for this staging stack.

Do not use an administrator role for portfolio deploys. Keep Terraform Cloud's infrastructure credentials separate from GitHub Actions deploy credentials.

## Manual Workflow

`AWS Staging Scaffold` supports these manual operations:

| Operation | Behavior |
|---|---|
| `validate` | Runs release config validation and Terraform static validation only. |
| `deploy-frontend` | Builds with `VITE_HALLIGALLI_BACKEND_URL`, syncs static assets to S3, and invalidates CloudFront. Requires `STAGING_APPLY`. |
| `deploy-backend` | Builds and pushes an ECR image, updates ECS to a new task definition revision, waits for stability, then checks `/readyz` and `/health`. Requires `STAGING_APPLY`. |
| `smoke-backend` | Checks `/readyz` and `/health` against the configured backend URL. It prints the `/health` JSON by default, and validates release identity with `.github/utils/check_health.py` when both expected version and expected commit inputs are provided. |

Normal CI/CD required checks remain `Product checks` and `Container build and scan`. AWS staging infrastructure changes are classified as Delivery Control, so the PR still reports stable required checks without deploying AWS resources.

## Live Acceptance Checklist

Stage 2.1 is complete only when all of these are true:

- Terraform Cloud has a reviewed `halligalli-aws-staging` workspace with no state or `.tfvars` committed to Git.
- GitHub deploy jobs authenticate to AWS through OIDC, not long-lived access keys.
- `https://play.halligalli.games` serves the AWS staging frontend over HTTPS.
- `https://api.halligalli.games/readyz` returns readiness through the ALB.
- `https://api.halligalli.games/health` returns the expected staging image tag and commit SHA.
- Browser multiplayer works from the AWS staging frontend over WSS/socket.io.
- `AWS Staging Scaffold` can deploy frontend and backend separately through manual dispatch.
- CloudWatch Logs contain backend startup and request logs useful for basic debugging.
- Terraform can recreate the environment from the committed root and Terraform Cloud variables.
- The documented teardown or scale-down path has been tested.
- DO Production remains available and unchanged by AWS staging activation.

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
