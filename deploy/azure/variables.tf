variable "project_name" {
  description = "Short project name used in Azure Production resource names."
  type        = string
  default     = "halligalli"

  validation {
    condition     = var.project_name == "halligalli"
    error_message = "This Terraform root is scoped to the Halligalli Child Repo."
  }
}

variable "azure_region" {
  description = "Azure Production runtime region. westeurope is the default; northeurope is only a fallback for capacity or availability."
  type        = string
  default     = "westeurope"

  validation {
    condition     = contains(["westeurope", "northeurope"], var.azure_region)
    error_message = "Azure Production may only use westeurope or the northeurope fallback."
  }
}

variable "static_web_app_location" {
  description = "Azure Static Web Apps location for the frontend. Keep aligned with available Static Web Apps regions."
  type        = string
  default     = "westeurope"

  validation {
    condition     = contains(["westeurope", "northeurope"], var.static_web_app_location)
    error_message = "Static Web Apps location may only use westeurope or the northeurope fallback."
  }
}

variable "domain_name" {
  description = "Domain used by Azure Production DNS records at Name.com."
  type        = string
  default     = "halligalli.games"

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9.-]*[a-z0-9]$", var.domain_name))
    error_message = "Domain name must be a lowercase DNS name."
  }
}

variable "frontend_subdomain" {
  description = "Subdomain for the Azure Static Web Apps frontend."
  type        = string
  default     = "play"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.frontend_subdomain))
    error_message = "Frontend subdomain must be a lowercase DNS label."
  }
}

variable "backend_subdomain" {
  description = "Subdomain for the secure Azure Container Apps Backend Entry."
  type        = string
  default     = "api"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.backend_subdomain))
    error_message = "Backend subdomain must be a lowercase DNS label."
  }
}

variable "resource_group_name" {
  description = "Optional existing-looking resource group name override for the Azure Production."
  type        = string
  default     = null
  nullable    = true

  validation {
    condition     = var.resource_group_name == null || can(regex("^[A-Za-z0-9_.()\\-]{1,90}$", var.resource_group_name))
    error_message = "Resource group name must be a valid Azure resource group name."
  }
}

variable "static_web_app_name" {
  description = "Optional Static Web App name override. Defaults to the Azure Production name prefix."
  type        = string
  default     = null
  nullable    = true

  validation {
    condition     = var.static_web_app_name == null || can(regex("^[A-Za-z0-9][A-Za-z0-9-]{1,58}[A-Za-z0-9]$", var.static_web_app_name))
    error_message = "Static Web App name must be 3-60 alphanumeric or hyphen characters."
  }
}

variable "log_analytics_retention_days" {
  description = "Log Analytics retention days for Azure Production diagnostics."
  type        = number
  default     = 7

  validation {
    condition     = var.log_analytics_retention_days == 7
    error_message = "Azure Production Log Retention must stay at seven days for the student-credit boundary."
  }
}

variable "backend_image" {
  description = "Bootstrap backend image used by Terraform before the deployment workflow owns normal image rollout."
  type        = string
  default     = "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest"

  validation {
    condition     = can(regex("^[A-Za-z0-9][A-Za-z0-9._/:@-]+$", var.backend_image))
    error_message = "Backend image must look like a container image reference."
  }
}

variable "backend_min_replicas" {
  description = "Minimum backend replicas. Use 0 for scale-down or bootstrap, 1 for demo serving."
  type        = number
  default     = 0

  validation {
    condition     = contains([0, 1], var.backend_min_replicas)
    error_message = "Backend minimum replicas may only be 0 or 1."
  }
}

variable "backend_max_replicas" {
  description = "Maximum backend replicas. Must remain one until multiplayer authority is externalized."
  type        = number
  default     = 1

  validation {
    condition     = var.backend_max_replicas == 1
    error_message = "Azure Production backend max_replicas must remain 1."
  }
}

variable "backend_app_version" {
  description = "Release Identity placeholder for APP_VERSION until the manual Azure Production deployment workflow injects a release value."
  type        = string
  default     = "azure-production-placeholder"

  validation {
    condition     = length(trimspace(var.backend_app_version)) > 0
    error_message = "Backend APP_VERSION placeholder must not be empty."
  }
}

variable "backend_commit_sha" {
  description = "Release Identity placeholder for COMMIT_SHA until the manual Azure Production deployment workflow injects a commit SHA."
  type        = string
  default     = "0000000000000000000000000000000000000000"

  validation {
    condition     = can(regex("^[0-9a-f]{7,40}$", var.backend_commit_sha))
    error_message = "Backend COMMIT_SHA placeholder must look like a lowercase git SHA."
  }
}

variable "github_repository" {
  description = "GitHub owner/repository expected to operate Azure Production through the protected GitHub Environment."
  type        = string
  default     = "example-owner/example-repo"

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github_repository))
    error_message = "GitHub repository must use owner/repository format."
  }
}

variable "azure_deploy_principal_id" {
  description = "Optional Microsoft Entra object ID for the federated deployment identity that may update Container Apps."
  type        = string
  default     = null
  nullable    = true

  validation {
    condition     = var.azure_deploy_principal_id == null || can(regex("^[0-9a-fA-F-]{36}$", var.azure_deploy_principal_id))
    error_message = "Azure deploy principal ID must be a GUID."
  }
}
