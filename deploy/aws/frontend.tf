locals {
  frontend = {
    hostname            = local.dns.frontend_hostname
    public_url          = "https://${local.dns.frontend_hostname}"
    backend_url         = local.backend_runtime.backend_entry
    bucket_prefix       = "${local.name_prefix}-frontend-"
    s3_origin_id        = "${local.name_prefix}-frontend-s3"
    certificate_region  = local.dns.cloudfront_certificate_region
    cloudfront_price    = "PriceClass_100"
    default_root_object = "index.html"

    vite_environment = {
      VITE_HALLIGALLI_BACKEND_URL = local.backend_runtime.backend_entry
    }
  }

  frontend_static = {
    purpose                = "Serve the Vite static build for AWS Production"
    hostname               = local.frontend.hostname
    public_url             = local.frontend.public_url
    asset_origin           = "Amazon S3"
    cdn                    = "Amazon CloudFront"
    backend_entry          = local.frontend.backend_url
    cloudfront_price_class = local.frontend.cloudfront_price
    public_bucket_access   = false
    default_root_object    = local.frontend.default_root_object
    vite_environment       = local.frontend.vite_environment
  }
}

provider "aws" {
  alias  = "cloudfront_certificate"
  region = local.frontend.certificate_region

  default_tags {
    tags = local.common_tags
  }
}

resource "aws_s3_bucket" "frontend_assets" {
  bucket_prefix = local.frontend.bucket_prefix
  force_destroy = true

  tags = merge(local.common_tags, {
    Name      = "${local.name_prefix}-frontend-assets"
    Component = "frontend"
    Role      = "static-assets"
  })
}

resource "aws_s3_bucket_ownership_controls" "frontend_assets" {
  bucket = aws_s3_bucket.frontend_assets.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "frontend_assets" {
  bucket = aws_s3_bucket.frontend_assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "frontend_assets" {
  bucket = aws_s3_bucket.frontend_assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_cloudfront_origin_access_control" "frontend_assets" {
  name                              = "${local.name_prefix}-frontend-assets"
  description                       = "CloudFront access control for the Halligalli AWS Production Vite asset bucket."
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_acm_certificate" "frontend" {
  provider = aws.cloudfront_certificate

  domain_name       = local.frontend.hostname
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(local.common_tags, {
    Name      = "${local.name_prefix}-frontend"
    Component = "frontend"
    Role      = "cloudfront-certificate"
  })
}

resource "aws_route53_record" "frontend_certificate_validation" {
  for_each = var.route53_zone_id == null ? {} : {
    for option in aws_acm_certificate.frontend.domain_validation_options : option.domain_name => {
      name   = option.resource_record_name
      record = option.resource_record_value
      type   = option.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = var.route53_zone_id
}

resource "aws_acm_certificate_validation" "frontend" {
  provider = aws.cloudfront_certificate
  count    = var.route53_zone_id == null ? 0 : 1

  certificate_arn         = aws_acm_certificate.frontend.arn
  validation_record_fqdns = [for record in aws_route53_record.frontend_certificate_validation : record.fqdn]
}

resource "aws_cloudfront_distribution" "frontend" {
  aliases             = [local.frontend.hostname]
  comment             = "Halligalli AWS Production frontend"
  default_root_object = local.frontend.default_root_object
  enabled             = var.frontend_cloudfront_enabled
  http_version        = "http2"
  is_ipv6_enabled     = true
  price_class         = local.frontend.cloudfront_price
  retain_on_delete    = false
  wait_for_deployment = false

  origin {
    domain_name              = aws_s3_bucket.frontend_assets.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend_assets.id
    origin_id                = local.frontend.s3_origin_id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    target_origin_id       = local.frontend.s3_origin_id
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  custom_error_response {
    error_caching_min_ttl = 0
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
  }

  custom_error_response {
    error_caching_min_ttl = 0
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.frontend.arn
    minimum_protocol_version = "TLSv1.2_2021"
    ssl_support_method       = "sni-only"
  }

  lifecycle {
    precondition {
      condition     = var.route53_zone_id != null
      error_message = "Set route53_zone_id before planning or applying the CloudFront frontend slice so DNS validation can complete."
    }
  }

  depends_on = [
    aws_acm_certificate_validation.frontend,
  ]

  tags = merge(local.common_tags, {
    Name      = "${local.name_prefix}-frontend"
    Component = "frontend"
    Role      = "cdn"
  })
}

resource "aws_s3_bucket_policy" "frontend_assets" {
  bucket = aws_s3_bucket.frontend_assets.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontReadOnly"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action = [
          "s3:GetObject",
        ]
        Resource = "${aws_s3_bucket.frontend_assets.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend.arn
          }
        }
      },
    ]
  })

  depends_on = [
    aws_s3_bucket_public_access_block.frontend_assets,
  ]
}

resource "aws_route53_record" "frontend_ipv4" {
  count = var.route53_zone_id == null ? 0 : 1

  name    = local.frontend.hostname
  type    = "A"
  zone_id = var.route53_zone_id

  alias {
    evaluate_target_health = false
    name                   = aws_cloudfront_distribution.frontend.domain_name
    zone_id                = aws_cloudfront_distribution.frontend.hosted_zone_id
  }
}

resource "aws_route53_record" "frontend_ipv6" {
  count = var.route53_zone_id == null ? 0 : 1

  name    = local.frontend.hostname
  type    = "AAAA"
  zone_id = var.route53_zone_id

  alias {
    evaluate_target_health = false
    name                   = aws_cloudfront_distribution.frontend.domain_name
    zone_id                = aws_cloudfront_distribution.frontend.hosted_zone_id
  }
}
