locals {
  observability_scaffold = {
    backend_log_group_name = "/aws/ecs/${local.name_prefix}/backend"
    log_retention_days     = local.cost_guardrails.log_retention_days
    dashboard_default      = false
    alarm_default          = false
    note                   = "Keep backend CloudWatch Logs retention short for demo-friendly staging cost control"
  }
}

resource "aws_cloudwatch_log_group" "backend" {
  name              = local.observability_scaffold.backend_log_group_name
  retention_in_days = local.observability_scaffold.log_retention_days

  tags = {
    Name = "${local.name_prefix}-backend"
  }
}
