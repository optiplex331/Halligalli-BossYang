# AWS Deployment Reference

This Terraform root is a sanitized AWS deployment reference for portfolio review. It shows the intended Halligalli AWS Production Scaffold architecture without committing real account-specific configuration.

Real AWS account values, HCP Terraform workspace wiring, GitHub OIDC subjects, Route 53 hosted zone IDs, domain bindings, generated tfvars, Terraform state, plans, and secrets are intentionally excluded from Git.

## Resource Shape

- Frontend: private S3 bucket, CloudFront, Origin Access Control, ACM certificate in `us-east-1`, and optional Route 53 alias records.
- Backend: ECR repository, public ALB, ECS Fargate service, one backend task, and CloudWatch Logs.
- DNS: Route 53 records for configurable frontend and backend hostnames.
- Identity: GitHub Actions OIDC provider support, a Terraform role, and a narrower deploy role.
- Cost posture: no NAT Gateway by default, short log retention, CloudFront disabled until explicitly enabled.

The committed defaults use `example.com` and `example-owner/example-repo`. Override real values through the protected `aws-production-scaffold` GitHub Environment.

## Private Runtime Config

The public repo keeps only examples:

- `terraform.tfvars.example` shows the Terraform value shape.
- `backend.hcl.example` shows the HCP Terraform remote-state backend shape.

The operating path is the manual `AWS Production Scaffold Infrastructure` workflow. It reads private values from the `aws-production-scaffold` GitHub Environment, writes temporary `backend.hcl` and `terraform.auto.tfvars.json` files under the runner temp directory, and runs Terraform CLI on the GitHub Actions runner.

HCP Terraform stores remote state and state versions. It does not execute Terraform runs for this project phase.

Keep `.terraform/`, generated backend config, generated tfvars, state, and plan files ignored. The ignore rules remain a safety net, not the documented operating path for real configuration.

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

## Operating A Real Environment

Use `.github/workflows/aws-production-scaffold-infra.yml`:

- `plan` reads HCP remote state and AWS account state without changing resources.
- `apply` creates or changes infrastructure after protected approval and `AWS_PRODUCTION_APPLY`.
- `scale-down` applies the same root with `backend_desired_count=0` after `AWS_PRODUCTION_SCALE_DOWN`.
- `destroy` runs Terraform destroy after protected approval and `AWS_PRODUCTION_DESTROY`.

Do not run `terraform apply` as a validation shortcut. A real apply creates cost-bearing AWS resources and should happen only through the protected infrastructure workflow after reviewing the plan, HCP state workspace, AWS role, DNS ownership, certificate setup, and production lifecycle.

## Public Boundary

Tracked files in this root are the Terraform architecture, variable definitions, examples, and documentation. Ignored files include generated local environment configuration, backend config, `.terraform/`, state, plan files, and tfvars.
