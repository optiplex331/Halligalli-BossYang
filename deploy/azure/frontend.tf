resource "azurerm_resource_group" "production" {
  name     = local.resource_group_name
  location = var.azure_region
  tags     = local.common_tags
}

resource "azurerm_static_web_app" "frontend" {
  name                = local.static_web_app_name
  resource_group_name = azurerm_resource_group.production.name
  location            = var.static_web_app_location
  sku_tier            = "Free"
  sku_size            = "Free"
  tags                = local.common_tags
}

resource "azurerm_static_web_app_custom_domain" "frontend" {
  count = var.domain_name == "halligalli.games" ? 1 : 0

  static_web_app_id = azurerm_static_web_app.frontend.id
  domain_name       = local.dns.frontend_hostname
  validation_type   = "cname-delegation"
}
