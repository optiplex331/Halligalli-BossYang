locals {
  observability = {
    backend_log_group_name = "/aws/ecs/${local.name_prefix}/backend"
    log_retention_days     = 14
    dashboard_default      = false
    alarm_default          = false
    note                   = "Keep backend CloudWatch Logs retention short for cost control"
  }
}

resource "aws_cloudwatch_log_group" "backend" {
  name              = local.observability.backend_log_group_name
  retention_in_days = local.observability.log_retention_days

  tags = {
    Name = "${local.name_prefix}-backend"
  }
}
