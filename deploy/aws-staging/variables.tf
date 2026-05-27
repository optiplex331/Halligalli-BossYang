variable "project_name" {
  description = "Short project name used in AWS Staging resource names."
  type        = string
  default     = "halligalli"

  validation {
    condition     = var.project_name == "halligalli"
    error_message = "This staging root is scoped to the Halligalli Child Repo."
  }
}

variable "aws_region" {
  description = "AWS Staging/Portfolio runtime region."
  type        = string
  default     = "eu-west-1"

  validation {
    condition     = var.aws_region == "eu-west-1"
    error_message = "AWS Staging/Portfolio is fixed to eu-west-1 for this scaffold."
  }
}

variable "domain_name" {
  description = "AWS Staging/Portfolio public domain."
  type        = string
  default     = "halligalli.games"

  validation {
    condition     = var.domain_name == "halligalli.games"
    error_message = "AWS Staging/Portfolio is fixed to halligalli.games for this scaffold."
  }
}

variable "frontend_subdomain" {
  description = "Subdomain reserved for the future AWS Staging frontend."
  type        = string
  default     = "play"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.frontend_subdomain))
    error_message = "Frontend subdomain must be a lowercase DNS label."
  }
}

variable "backend_subdomain" {
  description = "Subdomain reserved for the future AWS Staging backend entry."
  type        = string
  default     = "api"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.backend_subdomain))
    error_message = "Backend subdomain must be a lowercase DNS label."
  }
}

variable "enable_nat_gateway" {
  description = "Cost guardrail: NAT Gateway is not part of the default AWS Staging shape."
  type        = bool
  default     = false

  validation {
    condition     = var.enable_nat_gateway == false
    error_message = "NAT Gateway must stay disabled until a future issue explicitly accepts the cost."
  }
}
