output "frontend_public_url" {
  description = "Future public AWS Production frontend address."
  value       = local.frontend.public_url
}

output "frontend_asset_bucket" {
  description = "S3 bucket that will hold the Vite static build artifacts."
  value       = aws_s3_bucket.frontend_assets.id
}

output "frontend_cloudfront_distribution" {
  description = "CloudFront distribution placeholder for the Vite frontend."
  value = {
    id          = aws_cloudfront_distribution.frontend.id
    domain_name = aws_cloudfront_distribution.frontend.domain_name
    enabled     = aws_cloudfront_distribution.frontend.enabled
  }
}

output "frontend_certificate_validation_records" {
  description = "DNS validation records Terraform will manage when route53_zone_id is provided."
  value = {
    for name, record in aws_route53_record.frontend_certificate_validation : name => {
      name  = record.name
      type  = record.type
      value = one(record.records)
    }
  }
}

output "frontend_dns_alias_records" {
  description = "Route 53 alias records reserved for the frontend hostname when route53_zone_id is provided."
  value = {
    ipv4 = local.frontend.hostname
    ipv6 = local.frontend.hostname
  }
}

output "frontend_vite_build_environment" {
  description = "Environment values expected when building the AWS Production Vite frontend assets."
  value       = local.frontend.vite_environment
}
