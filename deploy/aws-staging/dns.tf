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

resource "aws_route53_record" "backend_ipv4" {
  count = var.route53_zone_id == null ? 0 : 1

  name    = local.dns.backend_hostname
  type    = "A"
  zone_id = var.route53_zone_id

  alias {
    evaluate_target_health = true
    name                   = aws_lb.backend.dns_name
    zone_id                = aws_lb.backend.zone_id
  }
}
