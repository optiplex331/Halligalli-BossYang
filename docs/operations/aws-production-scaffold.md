# AWS Production Scaffold Reference

AWS Production Scaffold is a reviewable Stage 2 reference, not a live production cutover from DigitalOcean. DO Production remains the active production path through Release PR, Production Promotion, `deploy/production/app.yaml`, and the GitOps Reconciler.

The public repository intentionally contains only sanitized AWS/Terraform deployment architecture. Real account-specific values, HCP Terraform workspace wiring, generated tfvars, Terraform state, Terraform plans, GitHub OIDC subjects, Route 53 hosted zone IDs, domain bindings, AWS account wiring, and secrets are excluded from Git.

## Safety Boundary

Normal pushes and pull requests do not create AWS resources, push ECR images, update ECS, publish frontend assets, change DNS, or alter DO Production.

AWS-mutating work requires explicit human action:

1. Bootstrap the dedicated AWS Production Scaffold Terraform Role once outside this Terraform root.
2. Configure the protected `aws-production-scaffold` GitHub Environment with HCP, AWS, DNS, certificate, domain, OIDC, and scaffold values.
3. Run `.github/workflows/aws-production-scaffold-infra.yml` with `workflow_dispatch`.
4. For mutating infrastructure operations, type the required confirmation: `PRODUCTION_SCAFFOLD_APPLY`, `PRODUCTION_SCAFFOLD_SCALE_DOWN`, or `PRODUCTION_SCAFFOLD_DESTROY`.
5. Run `.github/workflows/aws-production-scaffold.yml` separately for frontend/backend application deployment.

Do not commit Terraform state, `.tfvars`, generated backend config, Terraform plans, AWS credentials, GitHub secrets, rendered task definitions, or local `.env` files. Do not upload those files as workflow artifacts or cache entries.

## Architecture

| Concern | Reference |
|---|---|
| Region | `eu-west-1` |
| Domain | Example value in Git; real domain comes from GitHub Environment values |
| Frontend | Vite static assets in S3 behind CloudFront |
| Backend | Node.js 24/socket.io container in ECR and ECS Fargate behind an ALB |
| DNS | Route 53 records for configured scaffold subdomains |
| State | HCP Terraform remote state; Terraform CLI runs on GitHub Actions |
| Production | Unchanged DO Production using GHCR Release Images |

The frontend build uses `VITE_HALLIGALLI_BACKEND_URL` from the configured scaffold backend URL. The backend task uses `HALLIGALLI_ALLOWED_ORIGINS` derived from the configured scaffold frontend URL.

`/readyz` is the Readiness Surface for traffic checks. `/health` still reports Release Identity for smoke and drift checks.

## Local Validation

These commands do not require AWS credentials or HCP Terraform access:

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

## Infrastructure Operation

`AWS Production Scaffold Infrastructure` supports these manual operations:

| Operation | Behavior |
|---|---|
| `plan` | Generates a real Terraform plan from GitHub Environment values, AWS account state, and HCP Terraform remote state. |
| `apply` | Generates a fresh saved plan and applies it in the same workflow run. Requires `PRODUCTION_SCAFFOLD_APPLY`. |
| `scale-down` | Generates a fresh saved plan with `backend_desired_count=0` and applies it. Requires `PRODUCTION_SCAFFOLD_SCALE_DOWN`. |
| `destroy` | Generates a fresh destroy plan and applies it. Requires `PRODUCTION_SCAFFOLD_DESTROY`. |

The workflow runs Terraform CLI on the GitHub Actions runner. HCP Terraform stores remote state and state versions; it does not execute Terraform runs in this project phase.

The workflow generates private files under the runner temp directory:

- `backend.hcl`
- `terraform.auto.tfvars.json`
- `tfplan`

These files are not committed, cached, or uploaded as artifacts.

## First Activation

Use this order when turning the reference into a live AWS Production Scaffold environment. Do not skip the bootstrap sequence: the first ECS service cannot run a real task until the ECR repository exists and contains an image.

1. Bootstrap the AWS Production Scaffold Terraform Role so GitHub OIDC can assume it.
2. Configure the `aws-production-scaffold` GitHub Environment values listed below.
3. Run `AWS Production Scaffold Infrastructure` with `operation=plan`.
4. Review the cost-bearing resources.
5. Run `operation=apply` with `confirm=PRODUCTION_SCAFFOLD_APPLY`, using `backend_desired_count=0` and a placeholder `backend_image_tag` so Terraform can create the base infrastructure and ECR repository without requiring a runnable backend task.
6. Copy Terraform outputs into the GitHub Environment variables used by the application deployment workflow.
7. Push a seed backend image to the ECR repository. Use a one-off operator push during first activation, then use the workflow for normal backend deployments after the service can pass smoke checks.
8. Run `operation=apply` again with `backend_desired_count=1` for a demo window, or keep the backend scaled down.
9. Run `AWS Production Scaffold` with `operation=deploy-backend` and `confirm_cost=PRODUCTION_SCAFFOLD_APPLY`.
10. Run `operation=deploy-frontend` with `confirm_cost=PRODUCTION_SCAFFOLD_APPLY`.
11. Run `operation=smoke-backend`, then verify the public frontend, `/readyz`, `/health`, and socket.io multiplayer path.

## GitHub Environment Values

Store real values in the `aws-production-scaffold` GitHub Environment.

### Infrastructure Workflow

| Type | Name | Purpose |
|---|---|---|
| Secret | `HCP_TERRAFORM_TOKEN` | Terraform CLI credential for HCP Terraform remote state. |
| Variable | `HCP_TERRAFORM_ORGANIZATION` | HCP Terraform organization for generated backend config. |
| Variable | `HCP_TERRAFORM_WORKSPACE` | HCP Terraform workspace for remote state. |
| Variable | `HCP_TERRAFORM_WORKSPACE_URL` | GitHub Environment URL target for infrastructure runs. |
| Variable | `AWS_PRODUCTION_SCAFFOLD_TERRAFORM_ROLE_ARN` | IAM role assumed by the infrastructure workflow through GitHub OIDC. |
| Variable | `AWS_PRODUCTION_SCAFFOLD_PROJECT_NAME` | Optional project-name override; defaults to `halligalli`. |
| Variable | `AWS_PRODUCTION_SCAFFOLD_AWS_REGION` | Optional runtime Region override; currently constrained to `eu-west-1`. |
| Variable | `AWS_PRODUCTION_SCAFFOLD_DOMAIN_NAME` | Scaffold domain controlled by the operator. |
| Variable | `AWS_PRODUCTION_SCAFFOLD_FRONTEND_SUBDOMAIN` | Optional frontend subdomain override; defaults to `play`. |
| Variable | `AWS_PRODUCTION_SCAFFOLD_BACKEND_SUBDOMAIN` | Optional Backend Entry subdomain override; defaults to `api`. |
| Variable | `AWS_PRODUCTION_SCAFFOLD_ROUTE53_ZONE_ID` | Hosted zone ID for certificate validation and frontend/backend aliases. |
| Variable | `AWS_PRODUCTION_SCAFFOLD_FRONTEND_CLOUDFRONT_ENABLED` | Enables the CloudFront distribution after the frontend slice is ready to serve traffic. |
| Variable | `AWS_PRODUCTION_SCAFFOLD_BACKEND_CERTIFICATE_ARN` | ACM certificate ARN in `eu-west-1` for the backend ALB listener. |
| Variable | `AWS_PRODUCTION_SCAFFOLD_BACKEND_IMAGE_TAG` | Bootstrap/baseline ECR image tag for the Terraform-managed task definition. |
| Variable | `AWS_PRODUCTION_SCAFFOLD_BACKEND_DESIRED_COUNT` | `0` for bootstrap or scale down, `1` for demos. |
| Variable | `AWS_PRODUCTION_SCAFFOLD_BACKEND_TASK_CPU` | Optional backend Fargate CPU override; defaults to `256`. |
| Variable | `AWS_PRODUCTION_SCAFFOLD_BACKEND_TASK_MEMORY` | Optional backend Fargate memory override; defaults to `512`. |
| Variable | `AWS_PRODUCTION_SCAFFOLD_GITHUB_REPOSITORY` | GitHub owner/repository allowed to assume scaffold roles. |
| Variable | `AWS_PRODUCTION_SCAFFOLD_GITHUB_OIDC_SUBJECTS` | Allowed GitHub OIDC `sub` claims. JSON array or comma-separated string. |
| Variable | `AWS_PRODUCTION_SCAFFOLD_GITHUB_OIDC_PROVIDER_ARN` | Optional existing GitHub OIDC provider ARN. |
| Variable | `AWS_PRODUCTION_SCAFFOLD_BACKEND_APP_VERSION` | Optional baseline Release Identity in the Terraform-managed task definition. |
| Variable | `AWS_PRODUCTION_SCAFFOLD_BACKEND_COMMIT_SHA` | Optional baseline commit SHA in the Terraform-managed task definition. |

### Deployment Workflow

| Type | Name | Purpose |
|---|---|---|
| Variable | `AWS_PRODUCTION_SCAFFOLD_DEPLOY_ROLE_ARN` | Narrow IAM role assumed by GitHub Actions through OIDC for manual scaffold deploys. |
| Variable | `AWS_PRODUCTION_SCAFFOLD_FRONTEND_URL` | Public scaffold frontend URL. |
| Variable | `AWS_PRODUCTION_SCAFFOLD_BACKEND_URL` | Public scaffold backend URL used by frontend builds and smoke checks. |
| Variable | `AWS_PRODUCTION_SCAFFOLD_FRONTEND_BUCKET` | S3 bucket created by Terraform for frontend assets. |
| Variable | `AWS_PRODUCTION_SCAFFOLD_CLOUDFRONT_DISTRIBUTION_ID` | CloudFront distribution to invalidate after frontend sync. |
| Variable | `AWS_PRODUCTION_SCAFFOLD_ECR_REGISTRY` | ECR registry host, for example `<account>.dkr.ecr.eu-west-1.amazonaws.com`. |
| Variable | `AWS_PRODUCTION_SCAFFOLD_ECR_REPOSITORY` | ECR repository name for the scaffold backend image. |
| Variable | `AWS_PRODUCTION_SCAFFOLD_ECS_CLUSTER` | ECS cluster name. |
| Variable | `AWS_PRODUCTION_SCAFFOLD_ECS_SERVICE` | ECS service name. |
| Variable | `AWS_PRODUCTION_SCAFFOLD_TASK_FAMILY` | ECS task definition family. |
| Variable | `AWS_PRODUCTION_SCAFFOLD_CONTAINER_NAME` | ECS container name, currently `backend`. |

## Ownership Boundary

Terraform owns the infrastructure shape and remote state. It may change ECS desired count for cost-aware lifecycle operations.

The deployment workflow owns normal application artifact rollout:

- frontend build, S3 sync, and CloudFront invalidation
- backend image build and ECR push
- ECS task definition revision registration
- ECS service update and smoke checks

Terraform owns the baseline ECS task definition, but normal AWS Production Scaffold image rollout is workflow-owned. The ECS service ignores `task_definition` drift so a later Terraform apply does not roll the service back from a workflow-deployed image revision. Do not remove that drift guard unless Terraform becomes the owner of AWS Production Scaffold application rollout.

## GitHub OIDC Requirements

The AWS IAM trust boundary should be scoped to this repository and the `aws-production-scaffold` GitHub Environment, not every branch or workflow in the repository.

Use two roles:

- Terraform role: manages AWS Production Scaffold infrastructure through Terraform.
- Deploy role: publishes application artifacts to existing scaffold resources.

Do not use an administrator role for portfolio deploys. Do not reintroduce long-lived AWS access key secrets for scaffold workflows. OIDC requires `id-token: write`; keep that permission scoped to scaffold automation.

## Live Acceptance Checklist

Stage 2.1 is complete only when all of these are true:

- HCP Terraform remote state works, and no state, plan, generated backend config, generated tfvars, or secrets are committed to Git.
- GitHub infrastructure jobs authenticate to AWS through the Terraform role.
- GitHub deploy jobs authenticate to AWS through the deploy role.
- The configured scaffold frontend serves over HTTPS.
- The configured scaffold backend returns readiness through the ALB.
- The configured scaffold backend `/health` returns the expected scaffold image tag and commit SHA.
- Browser multiplayer works from the AWS Production Scaffold frontend over WSS/socket.io.
- The infrastructure workflow can run `plan`, `apply`, `scale-down`, and `destroy` through manual dispatch.
- The deployment workflow can deploy frontend and backend separately through manual dispatch.
- CloudWatch Logs contain backend startup and request logs useful for basic debugging.
- DO Production remains available and unchanged by AWS Production Scaffold activation.

## Cost And Lifecycle

The intended lifecycle is demo-oriented:

1. Apply or scale up only when preparing a portfolio demo.
2. Demo the frontend, backend, `/readyz`, `/health`, and socket.io multiplayer path.
3. Run `scale-down` afterward for ordinary cost control.
4. Run `destroy` only when intentionally tearing down the environment.
