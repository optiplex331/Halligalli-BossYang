output "azure_production_region" {
  description = "Accepted Azure Production Scaffold runtime region."
  value       = var.azure_region
}

output "azure_production_environment" {
  description = "Protected GitHub Environment name for Azure Production Scaffold values."
  value       = local.environment_name
}

output "azure_production_domain" {
  description = "Domain whose Name.com DNS records are configured manually for Azure Production Scaffold."
  value       = var.domain_name
}

output "azure_production_hostnames" {
  description = "Public hostnames for Azure Production Scaffold."
  value = {
    frontend = local.dns.frontend_hostname
    backend  = local.dns.backend_hostname
    apex     = local.dns.apex_reserved
  }
}

output "frontend_public_url" {
  description = "Public Azure Production Scaffold frontend address."
  value       = local.frontend.public_url
}

output "frontend_static_web_app" {
  description = "Static Web Apps values needed by manual frontend deployment and custom-domain activation."
  value = {
    name              = azurerm_static_web_app.frontend.name
    resource_group    = azurerm_resource_group.scaffold.name
    default_host_name = azurerm_static_web_app.frontend.default_host_name
    custom_hostname   = local.dns.frontend_hostname
  }
}

output "frontend_vite_build_environment" {
  description = "Environment values expected when building Azure Production Scaffold Vite frontend assets."
  value       = local.frontend.vite_environment
}

output "backend_public_url" {
  description = "Secure Backend Entry for Azure Production Scaffold readiness, health, and socket.io traffic."
  value       = local.backend.public_url
}

output "backend_container_app" {
  description = "Container Apps values needed by the manual backend deployment workflow."
  value = {
    name                = azurerm_container_app.backend.name
    resource_group      = azurerm_resource_group.scaffold.name
    latest_revision_url = "https://${azurerm_container_app.backend.latest_revision_fqdn}"
    custom_hostname     = local.dns.backend_hostname
    min_replicas        = var.backend_min_replicas
    max_replicas        = var.backend_max_replicas
  }
}

output "backend_runtime_environment" {
  description = "Non-secret runtime environment represented in the Azure Production Scaffold backend Container App."
  value = {
    HALLIGALLI_ALLOWED_ORIGINS = local.backend.allowed_origins
    APP_VERSION                = var.backend_app_version
    COMMIT_SHA                 = var.backend_commit_sha
  }
}

output "namecom_dns_records" {
  description = "Name.com DNS records the operator must configure or confirm during custom-domain activation."
  value = {
    frontend = {
      type  = "CNAME"
      name  = local.dns.frontend_hostname
      value = azurerm_static_web_app.frontend.default_host_name
      note  = "Static Web Apps custom-domain validation may also show a TXT record in Azure; add that record at Name.com when requested."
    }
    backend = {
      type  = "CNAME"
      name  = local.dns.backend_hostname
      value = azurerm_container_app.backend.latest_revision_fqdn
      note  = "Confirm the current Container Apps custom-domain target in Azure before adding the Name.com record."
    }
  }
}

output "cost_guardrails" {
  description = "Azure Student Credit Boundary guardrails encoded in this root."
  value = {
    static_web_apps_sku         = "Free"
    container_apps_max_replicas = var.backend_max_replicas
    container_apps_min_replicas = var.backend_min_replicas
    log_retention_days          = var.log_analytics_retention_days
    azure_dns_managed           = false
    front_door_enabled          = false
    aks_enabled                 = false
  }
}
