variable "frontend_route53_zone_id" {
  description = "Route 53 hosted zone ID for halligalli.games. Leave null for local scaffold validation; set it only when planning/applying the frontend slice."
  type        = string
  default     = null
  nullable    = true

  validation {
    condition     = var.frontend_route53_zone_id == null || can(regex("^Z[A-Z0-9]+$", var.frontend_route53_zone_id))
    error_message = "Route 53 hosted zone IDs usually start with Z and contain uppercase letters or digits."
  }
}

variable "frontend_cloudfront_enabled" {
  description = "Whether the AWS Staging CloudFront distribution should serve traffic after apply. Defaults off for scaffold review."
  type        = bool
  default     = false
}
