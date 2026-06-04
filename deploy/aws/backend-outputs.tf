output "backend_entry" {
  description = "Future secure Backend Entry for AWS Production HTTP, readiness, health, and socket.io traffic."
  value       = local.backend_runtime.backend_entry
}

output "backend_ecr_repository_url" {
  description = "AWS Production Image repository for the backend container."
  value       = aws_ecr_repository.backend.repository_url
}

output "backend_alb_dns_name" {
  description = "Public ALB DNS name to use as the future Route 53 alias target for the backend hostname."
  value       = aws_lb.backend.dns_name
}

output "backend_alb_zone_id" {
  description = "Public ALB hosted zone ID to use as the future Route 53 alias target for the backend hostname."
  value       = aws_lb.backend.zone_id
}

output "backend_dns_alias_record" {
  description = "Route 53 alias record reserved for the backend hostname when route53_zone_id is provided."
  value       = local.dns.backend_hostname
}

output "backend_health_paths" {
  description = "Backend HTTP surfaces expected by AWS Production smoke checks and ALB target health."
  value = {
    health    = local.backend_runtime.health_path
    readiness = local.backend_runtime.readiness_path
    websocket = local.backend_runtime.websocket_path
  }
}

output "backend_runtime_environment" {
  description = "Non-secret runtime environment represented in the AWS Production backend task definition."
  value = {
    HALLIGALLI_ALLOWED_ORIGINS = local.backend_runtime.allowed_origins
    APP_VERSION                = var.backend_app_version
    COMMIT_SHA                 = var.backend_commit_sha
  }
}

output "backend_default_desired_count" {
  description = "Single-task AWS Production backend default; values above one are intentionally rejected."
  value       = local.backend_runtime.default_desired_count
}

output "backend_log_group_name" {
  description = "CloudWatch Logs group for AWS Production backend container logs."
  value       = aws_cloudwatch_log_group.backend.name
}
