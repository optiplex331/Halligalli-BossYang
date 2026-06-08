resource "azurerm_log_analytics_workspace" "backend" {
  name                = local.log_workspace_name
  resource_group_name = azurerm_resource_group.scaffold.name
  location            = azurerm_resource_group.scaffold.location
  sku                 = "PerGB2018"
  retention_in_days   = var.log_analytics_retention_days
  tags                = local.common_tags
}

resource "azurerm_container_app_environment" "backend" {
  name                       = local.container_app_env_name
  resource_group_name        = azurerm_resource_group.scaffold.name
  location                   = azurerm_resource_group.scaffold.location
  log_analytics_workspace_id = azurerm_log_analytics_workspace.backend.id
  tags                       = local.common_tags
}

resource "azurerm_role_assignment" "deploy_container_app_contributor" {
  count = var.azure_deploy_principal_id == null ? 0 : 1

  scope                = azurerm_resource_group.scaffold.id
  role_definition_name = "Container Apps Contributor"
  principal_id         = var.azure_deploy_principal_id
}

resource "azurerm_container_app" "backend" {
  name                         = local.backend_app_name
  container_app_environment_id = azurerm_container_app_environment.backend.id
  resource_group_name          = azurerm_resource_group.scaffold.name
  revision_mode                = local.backend.revision_mode
  tags                         = local.common_tags

  ingress {
    external_enabled = true
    target_port      = local.backend.container_port
    transport        = local.backend.ingress_transport

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = var.backend_min_replicas
    max_replicas = var.backend_max_replicas

    container {
      name   = local.backend.container_name
      image  = var.backend_image
      cpu    = local.backend.cpu
      memory = local.backend.memory

      env {
        name  = "PORT"
        value = tostring(local.backend.container_port)
      }

      env {
        name  = "HALLIGALLI_ALLOWED_ORIGINS"
        value = local.backend.allowed_origins
      }

      env {
        name  = "APP_VERSION"
        value = var.backend_app_version
      }

      env {
        name  = "COMMIT_SHA"
        value = var.backend_commit_sha
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].container[0].image,
      template[0].container[0].env,
    ]

    precondition {
      condition     = var.backend_max_replicas == 1
      error_message = "Azure Production Scaffold backend must not imply multiplayer horizontal scaling."
    }
  }
}

check "backend_scaling_guardrail" {
  assert {
    condition     = contains([0, 1], var.backend_min_replicas) && var.backend_max_replicas == 1
    error_message = "Backend scaling must allow zero-minimum-replica scale-down and reject max replicas above one."
  }
}

check "backend_readiness_surface" {
  assert {
    condition     = local.backend.readiness_path == "/readyz" && local.backend.health_path == "/health"
    error_message = "Azure Production Scaffold smoke checks must preserve /readyz and /health."
  }
}
