# AWS Staging Reference

AWS Staging/Portfolio is a reviewable Stage 2 reference, not a live production environment and not a cutover from DigitalOcean. DO Production remains the active production path through Release PR, Production Promotion, `deploy/production/app.yaml`, and the GitOps Reconciler.

The public repository intentionally contains only sanitized AWS/Terraform deployment architecture. Real account-specific values, tfvars, backend config, Terraform state, Terraform plans, GitHub OIDC subjects, Route 53 hosted zone IDs, domain bindings, AWS account wiring, and secrets are excluded from Git.

## Safety Boundary

Normal pushes and pull requests do not create AWS resources, push ECR images, update ECS, publish frontend assets, change DNS, or alter DO Production.

AWS-mutating work requires explicit human action:

1. Copy the example Terraform files into ignored local staging config.
2. Configure Terraform backend, AWS credentials, GitHub OIDC to AWS, Route 53, certificates, and GitHub environment values.
3. Run Terraform plan/apply deliberately from `deploy/aws/`.
4. Run `.github/workflows/aws-staging.yml` with `workflow_dispatch`.
5. For deploy operations, type `STAGING_APPLY` into the `confirm_cost` input.

Do not commit Terraform state, `.tfvars`, backend config, AWS credentials, GitHub secrets, rendered task definitions, or local `.env` files.

## Architecture

| Concern | Reference |
|---|---|
| Region | `eu-west-1` |
| Domain | Example value in Git; real domain comes from ignored local tfvars |
| Frontend | Vite static assets in S3 behind CloudFront |
| Backend | Node.js 24/socket.io container in ECR and ECS Fargate behind an ALB |
| DNS | Route 53 records for configured staging subdomains |
| State | Remote backend configured by ignored `backend.hcl` |
| Production | Unchanged DO Production using GHCR Release Images |

The frontend build uses `VITE_HALLIGALLI_BACKEND_URL` from the configured staging backend URL. The backend task uses `HALLIGALLI_ALLOWED_ORIGINS` derived from the configured staging frontend URL.

`/readyz` is the Readiness Surface for traffic checks. `/health` still reports Release Identity for smoke and drift checks.

## Local Terraform Files

Create ignored local staging config from the examples:

```bash
cd deploy/aws
mkdir -p environments/staging
cp terraform.tfvars.example environments/staging/terraform.tfvars
cp backend.hcl.example environments/staging/backend.hcl
```

Edit `environments/staging/terraform.tfvars` with the real staging domain, Route 53 hosted zone ID, ACM certificate ARN, GitHub repository, OIDC subjects, image tag, desired count, and other environment values.

Edit `environments/staging/backend.hcl` with the real Terraform backend organization and workspace. These files are ignored and must stay local.

## Local Validation

These commands do not require AWS credentials or Terraform backend credentials:

```bash
terraform -chdir=deploy/aws fmt -check -recursive
terraform -chdir=deploy/aws init -backend=false -input=false
terraform -chdir=deploy/aws validate -no-color
docker run --rm -v "${PWD}:/repo" --workdir /repo rhysd/actionlint:1.7.12 -color
pnpm run test
pnpm run typecheck
pnpm run build
```

Do not use `terraform apply` as a validation shortcut.

## Planning A Real Staging Environment

Use this order when turning the reference into a live AWS Staging/Portfolio environment. Do not skip the bootstrap sequence: the first ECS service cannot run a real task until the ECR repository exists and contains an image.

1. Create or confirm the remote Terraform backend workspace.
2. Fill `deploy/aws/environments/staging/backend.hcl`.
3. Fill `deploy/aws/environments/staging/terraform.tfvars`.
4. Let Terraform create the GitHub OIDC deploy role, or provide an existing GitHub OIDC provider ARN through `github_oidc_provider_arn`.
5. Run:

```bash
terraform -chdir=deploy/aws init \
  -backend-config=environments/staging/backend.hcl \
  -input=false
terraform -chdir=deploy/aws plan \
  -var-file=environments/staging/terraform.tfvars
```

6. Review the cost-bearing resources before apply.
7. Apply with `backend_desired_count=0` and a placeholder `backend_image_tag` so Terraform can create the base infrastructure and ECR repository without requiring a runnable backend task.
8. Copy Terraform outputs into the GitHub `aws-staging` environment variables listed below.
9. Push a seed backend image to the ECR repository. Use a one-off operator push during first activation, then use the workflow for normal backend deployments after the service can pass smoke checks.
10. Re-run Terraform with `backend_image_tag` matching the seed image tag and `backend_desired_count=1`, or leave desired count at `0` until a demo window.
11. Run the `AWS Staging Scaffold` workflow with `operation=deploy-backend` and `confirm_cost=STAGING_APPLY`.
12. Run `operation=deploy-frontend` with `confirm_cost=STAGING_APPLY`.
13. Run `operation=smoke-backend`, then verify the public frontend, `/readyz`, `/health`, and socket.io multiplayer path.

If the environment is only being prepared for a short portfolio demo, keep `backend_desired_count=0` outside the demo window and scale up deliberately.

## Terraform Variables

The real values below belong in ignored local tfvars, not Git:

| Variable | Required for live apply | Purpose |
|---|---|---|
| `domain_name` | Yes | Staging domain controlled by the operator. |
| `route53_zone_id` | Yes | Hosted zone ID for certificate validation and frontend/backend aliases. |
| `frontend_cloudfront_enabled` | Yes | Enables the CloudFront distribution after the frontend slice is ready to serve traffic. |
| `backend_certificate_arn` | Yes | ACM certificate ARN in `eu-west-1` for the backend ALB listener. |
| `backend_image_tag` | Yes | ECR image tag expected by the ECS task definition. |
| `backend_desired_count` | Yes | `0` for bootstrap/teardown, `1` for demos. Values above `1` are intentionally out of scope. |
| `github_repository` | Yes | GitHub owner/repository allowed to assume the deploy role. |
| `github_oidc_provider_arn` | Optional | Existing GitHub OIDC provider ARN. Leave null for this root to create the provider. |
| `github_oidc_thumbprint_list` | Optional | GitHub OIDC provider thumbprints used only when this root creates the provider. |
| `github_oidc_subjects` | Yes | Allowed GitHub OIDC `sub` claims, scoped to the `aws-staging` GitHub environment. |
| `backend_app_version` | Optional | Placeholder Release Identity in the Terraform-managed task definition. |
| `backend_commit_sha` | Optional | Placeholder commit SHA in the Terraform-managed task definition. |
| `backend_task_cpu` | Optional | Small Fargate CPU size for staging demos. |
| `backend_task_memory` | Optional | Small Fargate memory size for staging demos. |

Terraform owns the baseline ECS task definition, but normal AWS Staging image rollout is workflow-owned. The ECS service ignores `task_definition` drift so a later Terraform apply does not roll the service back from a workflow-deployed image revision.

## GitHub Configuration

Future manual deploys use the `aws-staging` GitHub environment.

| Type | Name | Purpose |
|---|---|---|
| Variable | `AWS_STAGING_ROLE_ARN` | IAM role assumed by GitHub Actions through OIDC for manual staging deploys. |
| Variable | `AWS_STAGING_FRONTEND_URL` | Public staging frontend URL. |
| Variable | `AWS_STAGING_BACKEND_URL` | Public staging backend URL used by frontend builds and smoke checks. |
| Variable | `AWS_STAGING_FRONTEND_BUCKET` | S3 bucket created by Terraform for frontend assets. |
| Variable | `AWS_STAGING_CLOUDFRONT_DISTRIBUTION_ID` | CloudFront distribution to invalidate after frontend sync. |
| Variable | `AWS_STAGING_ECR_REGISTRY` | ECR registry host, for example `<account>.dkr.ecr.eu-west-1.amazonaws.com`. |
| Variable | `AWS_STAGING_ECR_REPOSITORY` | ECR repository name for the staging backend image. |
| Variable | `AWS_STAGING_ECS_CLUSTER` | ECS cluster name. |
| Variable | `AWS_STAGING_ECS_SERVICE` | ECS service name. |
| Variable | `AWS_STAGING_TASK_FAMILY` | ECS task definition family. |
| Variable | `AWS_STAGING_CONTAINER_NAME` | ECS container name, currently `backend`. |

The live activation path uses `aws-actions/configure-aws-credentials` to assume `AWS_STAGING_ROLE_ARN` through GitHub OIDC. Do not reintroduce long-lived `AWS_STAGING_ACCESS_KEY_ID` or `AWS_STAGING_SECRET_ACCESS_KEY` secrets for staging deploys. OIDC requires `id-token: write`; keep that permission scoped to staging deployment automation.

Store real values only in ignored local files, GitHub environment variables, or the Terraform backend. Never commit them.

## GitHub OIDC Requirements

The AWS IAM role for staging deploys should trust only this repository and the `aws-staging` GitHub environment. The trust boundary should be scoped to `repo:<owner>/<repo>:environment:aws-staging`, not every branch or workflow in the repository.

Use a permission policy scoped to the deploy behavior:

- S3 object sync for the frontend asset bucket.
- CloudFront invalidation for the staging distribution.
- ECR login, image layer upload, and image push for the staging backend repository.
- ECS task definition read/register, service update, and service stability checks for the staging cluster/service.
- IAM `PassRole` only for the ECS task execution/task roles created for this staging stack.

Do not use an administrator role for portfolio deploys. Keep Terraform infrastructure credentials separate from GitHub Actions deploy credentials.

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

- Remote Terraform state is configured with no state, backend config, or `.tfvars` committed to Git.
- GitHub deploy jobs authenticate to AWS through OIDC, not long-lived access keys.
- The configured staging frontend serves over HTTPS.
- The configured staging backend returns readiness through the ALB.
- The configured staging backend `/health` returns the expected staging image tag and commit SHA.
- Browser multiplayer works from the AWS staging frontend over WSS/socket.io.
- `AWS Staging Scaffold` can deploy frontend and backend separately through manual dispatch.
- CloudWatch Logs contain backend startup and request logs useful for basic debugging.
- Terraform can recreate the environment from the committed root plus ignored local configuration.
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
