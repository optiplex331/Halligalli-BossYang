# AWS Deployment Reference

This Terraform root is a sanitized AWS deployment reference for portfolio review. It shows the intended Halligalli AWS Staging/Portfolio architecture without committing real account-specific configuration.

Real AWS account values, Terraform Cloud workspace settings, GitHub OIDC subjects, Route 53 hosted zone IDs, domain bindings, tfvars, backend config, Terraform state, plans, and secrets are intentionally excluded from Git.

## Resource Shape

- Frontend: private S3 bucket, CloudFront, Origin Access Control, ACM certificate in `us-east-1`, and optional Route 53 alias records.
- Backend: ECR repository, public ALB, ECS Fargate service, one backend task, and CloudWatch Logs.
- DNS: Route 53 records for configurable frontend and backend hostnames.
- Identity: GitHub Actions OIDC provider support and a scoped deploy role.
- Cost posture: no NAT Gateway by default, short log retention, CloudFront disabled until explicitly enabled.

The committed defaults use `example.com`, `example-owner/example-repo`, and an example Terraform Cloud workspace. Override those only in ignored local files.

## Local Staging Config

Create local staging files from the committed examples:

```bash
mkdir -p environments/staging
cp terraform.tfvars.example environments/staging/terraform.tfvars
cp backend.hcl.example environments/staging/backend.hcl
```

Then edit:

- `environments/staging/terraform.tfvars`
- `environments/staging/backend.hcl`

Both files are ignored by Git. Keep real domain names, Route 53 zone IDs, ACM certificate ARNs, AWS account IDs, Terraform Cloud organization/workspace names, and real GitHub OIDC subjects there.

## Static Validation

These commands do not require AWS credentials or Terraform backend credentials:

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
terraform init -backend-config=environments/staging/backend.hcl -input=false
terraform plan -var-file=environments/staging/terraform.tfvars
```

Do not run `terraform apply` as a validation shortcut. A real apply creates cost-bearing AWS resources and should happen only after reviewing the plan, backend, AWS credentials, DNS ownership, certificate setup, and staging lifecycle.

## Public Boundary

Tracked files in this root are the Terraform architecture, variable definitions, examples, and documentation. Ignored files include local environment configuration, backend config, `.terraform/`, state, plan files, and tfvars.
