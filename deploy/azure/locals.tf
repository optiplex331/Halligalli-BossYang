locals {
  environment_name = "azure-production"
  name_prefix      = "${var.project_name}-${local.environment_name}"

  resource_group_name    = coalesce(var.resource_group_name, "${local.name_prefix}-rg")
  static_web_app_name    = coalesce(var.static_web_app_name, local.name_prefix)
  container_app_env_name = "${local.name_prefix}-env"
  backend_app_name       = "${local.name_prefix}-backend"
  log_workspace_name     = "${local.name_prefix}-logs"

  dns = {
    authority         = "Name.com"
    zone_name         = var.domain_name
    frontend_hostname = "${var.frontend_subdomain}.${var.domain_name}"
    backend_hostname  = "${var.backend_subdomain}.${var.domain_name}"
    apex_reserved     = var.domain_name
  }

  frontend = {
    public_url = "https://${local.dns.frontend_hostname}"
    vite_environment = {
      VITE_HALLIGALLI_BACKEND_URL = "https://${local.dns.backend_hostname}"
    }
  }

  backend = {
    public_url          = "https://${local.dns.backend_hostname}"
    container_name      = "backend"
    container_port      = 3001
    health_path         = "/health"
    readiness_path      = "/readyz"
    websocket_path      = "/socket.io"
    cpu                 = 0.25
    memory              = "0.5Gi"
    allowed_origins     = local.frontend.public_url
    scale_down_minimum  = 0
    active_minimum      = 1
    maximum_replicas    = 1
    revision_mode       = "Single"
    ingress_transport   = "auto"
    bootstrap_note      = "Terraform creates the runtime boundary; the manual deployment workflow owns normal backend image rollout."
    multiplayer_warning = "max_replicas stays at 1 because multiplayer authority is in-process Node.js state."
  }

  common_tags = {
    Application   = "Halligalli"
    Environment   = local.environment_name
    ManagedBy     = "Terraform"
    Repository    = "Halligalli"
    TerraformRoot = "deploy/azure"
    Runtime       = "Node 24"
    Production    = "false"
    CostProfile   = "student-credit-production-demo"
    StateBackend  = "hcp-terraform-remote-state"
  }
}
