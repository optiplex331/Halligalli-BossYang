# AWS Deployment Reference

This Terraform root is a sanitized AWS deployment reference for portfolio review. It shows the intended Halligalli AWS Staging/Portfolio architecture without committing real account-specific configuration.

Real AWS account values, GitHub OIDC subjects, Route 53 hosted zone IDs, domain bindings, tfvars, Terraform state, plans, and secrets are intentionally excluded from Git.

## Resource Shape

- Frontend: private S3 bucket, CloudFront, Origin Access Control, ACM certificate in `us-east-1`, and optional Route 53 alias records.
- Backend: ECR repository, public ALB, ECS Fargate service, one backend task, and CloudWatch Logs.
- DNS: Route 53 records for configurable frontend and backend hostnames.
- Identity: GitHub Actions OIDC provider support and a scoped deploy role.
- Cost posture: no NAT Gateway by default, short log retention, CloudFront disabled until explicitly enabled.

The committed defaults use `example.com` and `example-owner/example-repo`. Override those only in ignored local files.

## Local Staging Config

Create local staging files from the committed examples:

```bash
mkdir -p environments/staging
cp terraform.tfvars.example environments/staging/terraform.tfvars
```

Then edit `environments/staging/terraform.tfvars`.

This file is ignored by Git. Keep real domain names, Route 53 zone IDs, ACM certificate ARNs, AWS account IDs, and real GitHub OIDC subjects there.

Terraform state is local for the current AWS Staging/Portfolio phase. Keep `.terraform/`, `terraform.tfstate`, plans, and local tfvars ignored.

## Static Validation

These commands do not require AWS credentials:

```bash
terraform fmt -check -recursive
terraform init -backend=false -input=false
terraform validate -no-color
```

If formatting changes are needed:

```bash
terraform fmt -recursive
```

## Planning A Real Environment

After filling the ignored local files, initialize and plan deliberately:

```bash
terraform init -input=false
terraform plan -var-file=environments/staging/terraform.tfvars
```

Do not run `terraform apply` as a validation shortcut. A real apply creates cost-bearing AWS resources and should happen only after reviewing the plan, local state location, AWS credentials, DNS ownership, certificate setup, and staging lifecycle.

## Public Boundary

Tracked files in this root are the Terraform architecture, variable definitions, examples, and documentation. Ignored files include local environment configuration, optional backend config, `.terraform/`, state, plan files, and tfvars.
