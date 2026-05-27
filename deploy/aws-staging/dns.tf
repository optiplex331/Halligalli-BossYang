locals {
  dns = {
    zone_name                     = var.domain_name
    frontend_hostname             = "${var.frontend_subdomain}.${var.domain_name}"
    backend_hostname              = "${var.backend_subdomain}.${var.domain_name}"
    runtime_region                = var.aws_region
    cloudfront_certificate_region = "us-east-1"
    authority                     = "Route 53"
  }
}
