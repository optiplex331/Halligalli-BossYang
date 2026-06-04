locals {
  environment_name = "aws-production-scaffold"
  name_prefix      = "${var.project_name}-${local.environment_name}"

  common_tags = {
    Application   = "Halligalli"
    Environment   = "aws-production-scaffold"
    ManagedBy     = "Terraform"
    Repository    = "Halligalli"
    TerraformRoot = "deploy/aws"
    Runtime       = "Node 24"
    Production    = "false"
    CostProfile   = "production-scaffold"
    StateBackend  = "configured-outside-git"
  }

  cost_guardrails = {
    live_production_provider    = "current-production-path"
    production_lifecycle        = "AWS scaffold manual activation; scale down outside demo windows"
    automatic_apply             = false
    deletion_protection_default = false
    always_on_capacity_default  = false
    nat_gateway_default         = false
    public_ipv4_minimize        = true
    log_retention_days          = 14
  }
}
