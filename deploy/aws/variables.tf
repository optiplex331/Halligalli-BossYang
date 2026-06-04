variable "project_name" {
  description = "Short project name used in AWS Production Scaffold resource names."
  type        = string
  default     = "halligalli"

  validation {
    condition     = var.project_name == "halligalli"
    error_message = "This Terraform root is scoped to the Halligalli Child Repo."
  }
}

variable "aws_region" {
  description = "AWS Production Scaffold runtime region."
  type        = string
  default     = "eu-west-1"

  validation {
    condition     = var.aws_region == "eu-west-1"
    error_message = "AWS Production Scaffold is fixed to eu-west-1."
  }
}

variable "domain_name" {
  description = "Public domain used by the AWS Production Scaffold reference. Override with GitHub Environment values for real infrastructure operations."
  type        = string
  default     = "example.com"

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9.-]*[a-z0-9]$", var.domain_name))
    error_message = "Domain name must be a lowercase DNS name."
  }
}

variable "frontend_subdomain" {
  description = "Subdomain reserved for the future AWS Production Scaffold frontend."
  type        = string
  default     = "play"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.frontend_subdomain))
    error_message = "Frontend subdomain must be a lowercase DNS label."
  }
}

variable "backend_subdomain" {
  description = "Subdomain reserved for the future AWS Production Scaffold backend entry."
  type        = string
  default     = "api"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.backend_subdomain))
    error_message = "Backend subdomain must be a lowercase DNS label."
  }
}

variable "enable_nat_gateway" {
  description = "Cost guardrail: NAT Gateway is not part of the default AWS Production Scaffold shape."
  type        = bool
  default     = false

  validation {
    condition     = var.enable_nat_gateway == false
    error_message = "NAT Gateway must stay disabled until a future issue explicitly accepts the cost."
  }
}

variable "route53_zone_id" {
  description = "Route 53 hosted zone ID for the configured domain. Leave null for local validation; set it through GitHub Environment values when planning/applying real DNS."
  type        = string
  default     = null
  nullable    = true

  validation {
    condition     = var.route53_zone_id == null || can(regex("^Z[A-Z0-9]+$", var.route53_zone_id))
    error_message = "Route 53 hosted zone IDs usually start with Z and contain uppercase letters or digits."
  }
}

variable "github_repository" {
  description = "GitHub owner/repository allowed to assume the AWS Production Scaffold deploy role through OIDC. Override in ignored tfvars for real deployments."
  type        = string
  default     = "example-owner/example-repo"

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github_repository))
    error_message = "GitHub repository must use owner/repository format."
  }
}

variable "github_oidc_provider_arn" {
  description = "Existing GitHub Actions OIDC provider ARN. Leave null to let this Terraform root create one for the AWS account."
  type        = string
  default     = null
  nullable    = true

  validation {
    condition     = var.github_oidc_provider_arn == null || can(regex("^arn:aws:iam::[0-9]{12}:oidc-provider/token\\.actions\\.githubusercontent\\.com$", var.github_oidc_provider_arn))
    error_message = "GitHub OIDC provider ARN must point at token.actions.githubusercontent.com."
  }
}

variable "github_oidc_thumbprint_list" {
  description = "Thumbprints used only when this root creates the GitHub Actions OIDC provider."
  type        = list(string)
  default     = ["6938fd4d98bab03faadb97b34396831e3780aea1"]

  validation {
    condition = alltrue([
      for thumbprint in var.github_oidc_thumbprint_list : can(regex("^[0-9a-f]{40}$", thumbprint))
    ])
    error_message = "GitHub OIDC thumbprints must be lowercase SHA-1 fingerprints."
  }
}

variable "github_oidc_subjects" {
  description = "GitHub OIDC subject claims allowed to assume the AWS Production Scaffold deploy role. Override in ignored tfvars for real deployments."
  type        = list(string)
  default     = ["repo:example-owner/example-repo:environment:aws-production-scaffold"]

  validation {
    condition     = length(var.github_oidc_subjects) > 0
    error_message = "At least one GitHub OIDC subject must be allowed."
  }
}
