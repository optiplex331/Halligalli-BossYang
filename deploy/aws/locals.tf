locals {
  environment_name = "aws-production"
  name_prefix      = "${var.project_name}-${local.environment_name}"

  common_tags = {
    Application   = "Halligalli"
    Environment   = "production"
    ManagedBy     = "Terraform"
    Repository    = "Halligalli"
    TerraformRoot = "deploy/aws"
    Runtime       = "Node 24"
    Production    = "true"
    CostProfile   = "small-production"
    StateBackend  = "configured-outside-git"
  }

  cost_guardrails = {
    live_production_provider    = "AWS"
    production_lifecycle        = "Manual activation; scale down when not serving traffic"
    automatic_apply             = false
    deletion_protection_default = false
    always_on_capacity_default  = false
    nat_gateway_default         = false
    public_ipv4_minimize        = true
    log_retention_days          = 14
  }
}
