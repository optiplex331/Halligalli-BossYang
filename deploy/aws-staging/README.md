# AWS Staging Terraform Scaffold

This root is the reviewable Terraform scaffold for the Halligalli AWS Staging/Portfolio environment. It declares the intended AWS resources, but it does not create anything unless a human deliberately runs Terraform plan/apply with credentials and accepted cost expectations. DO Production remains the only live production environment.

The accepted staging defaults are:

- AWS Region: `eu-west-1`
- Domain: `halligalli.games`
- Terraform state: Terraform Cloud workspace `halligalli-aws-staging`
- Default network shape: no NAT Gateway
- Frontend entry: `https://play.halligalli.games`
- Backend entry: `https://api.halligalli.games`

The files are organized by concern so frontend, backend, DNS, networking, and observability can evolve without introducing custom modules.

## Resource Shape

- Frontend: private S3 bucket, CloudFront, OAC, us-east-1 ACM certificate, and optional Route 53 records for `play.halligalli.games`.
- Backend: ECR repository, public ALB, ECS Fargate service, single backend task, CloudWatch Logs, and placeholders for `api.halligalli.games`.
- Runtime surfaces: frontend builds use `VITE_HALLIGALLI_BACKEND_URL=https://api.halligalli.games`; backend runtime allows `HALLIGALLI_ALLOWED_ORIGINS=https://play.halligalli.games`.
- Health checks: `/readyz` is for traffic readiness; `/health` keeps release identity checks.

## Static Validation

From this directory:

```bash
terraform fmt -check -recursive
terraform init -backend=false -input=false
terraform validate -no-color
```

`-backend=false` keeps validation local and avoids Terraform Cloud credentials. Do not run `terraform plan` or `terraform apply` until the Terraform Cloud organization/workspace, AWS credentials, and cost expectations are explicitly configured.

Real plan/apply also needs frontend DNS settings, a backend ACM certificate ARN, and an image tag that exists in ECR. See `docs/operations/aws-staging.md` for the manual workflow, required GitHub configuration, and teardown guidance.
