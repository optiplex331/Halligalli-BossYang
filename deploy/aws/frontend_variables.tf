variable "frontend_cloudfront_enabled" {
  description = "Whether the AWS Production Scaffold CloudFront distribution should serve traffic after apply. Defaults off for scaffold review."
  type        = bool
  default     = false
}
