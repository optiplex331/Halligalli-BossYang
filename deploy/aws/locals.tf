locals {
  environment_name = "aws-production-scaffold"
  name_prefix      = "${var.project_name}-${local.environment_name}"

  common_tags = {
    Application   = "Halligalli"
    Environment   = "production-scaffold"
    ManagedBy     = "Terraform"
    Repository    = "Halligalli"
    TerraformRoot = "deploy/aws"
    Runtime       = "Node 24"
    Production    = "false"
    CostProfile   = "demo-scale"
    StateBackend  = "configured-outside-git"
  }

  cost_guardrails = {
    live_production_provider      = "DigitalOcean App Platform"
    production_scaffold_lifecycle = "Create or scale up for demos; destroy or scale down afterward"
    automatic_apply               = false
    deletion_protection_default   = false
    always_on_capacity_default    = false
    nat_gateway_default           = false
    public_ipv4_minimize          = true
    log_retention_days            = 14
  }
}
