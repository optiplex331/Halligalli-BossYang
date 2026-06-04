output "aws_production_scaffold_region" {
  description = "Accepted AWS Production Scaffold region."
  value       = var.aws_region
}

output "aws_production_scaffold_domain" {
  description = "Accepted AWS Production Scaffold domain."
  value       = var.domain_name
}

output "aws_production_scaffold_hostnames" {
  description = "Reserved public hostnames for future frontend and backend slices."
  value = {
    frontend = local.dns.frontend_hostname
    backend  = local.dns.backend_hostname
  }
}

output "name_prefix" {
  description = "Shared prefix for future AWS Production Scaffold resource names."
  value       = local.name_prefix
}

output "common_tags" {
  description = "Shared tags applied by the AWS provider default_tags block."
  value       = local.common_tags
}

output "nat_gateway_default" {
  description = "Cost guardrail showing NAT Gateway is not part of the default scaffold."
  value       = local.networking_scaffold.nat_gateway_enabled
}

output "scaffold_resource_model" {
  description = "Review boundary for the AWS Production Scaffold Terraform root."
  value = {
    declares_reviewable_resources = true
    creates_resources_by_default  = false
    apply_requires_human_action   = true
  }
}

output "github_actions_deploy_role_arn" {
  description = "IAM role ARN for the aws-production-scaffold GitHub environment variable AWS_PRODUCTION_SCAFFOLD_DEPLOY_ROLE_ARN."
  value       = aws_iam_role.github_actions_deploy.arn
}
