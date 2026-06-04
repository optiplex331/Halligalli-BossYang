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

}
