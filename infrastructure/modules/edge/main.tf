# Borde (docs/aws-deploy.md, diagrama): un CloudFront con AWS WAF para los dos nombres públicos.
# CloudFront llega al ALB interno por un VPC origin, así que el ALB no se expone a internet.
# Nada se cachea: el BFF y la API responden contenido por usuario.

data "aws_cloudfront_cache_policy" "disabled" {
  name = "Managed-CachingDisabled"
}

# Reenvía todos los headers del espectador, incluido Host: el ALB rutea por host y el certificado
# del ALB se valida contra ese mismo nombre.
data "aws_cloudfront_origin_request_policy" "all_viewer" {
  name = "Managed-AllViewer"
}

data "aws_cloudfront_response_headers_policy" "security_headers" {
  name = "Managed-SecurityHeadersPolicy"
}

# --- AWS WAF (alcance CLOUDFRONT: vive en us-east-1) ---

resource "aws_wafv2_web_acl" "this" {
  provider = aws.us_east_1

  name  = var.name_prefix
  scope = "CLOUDFRONT"

  default_action {
    allow {}
  }

  # Primera barrera del rate limiting de login y registro (la API cuenta además por IP y correo).
  rule {
    name     = "auth-rate-limit"
    priority = 0

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit                 = var.auth_rate_limit_per_5_minutes
        aggregate_key_type    = "IP"
        evaluation_window_sec = 300

        scope_down_statement {
          or_statement {
            statement {
              byte_match_statement {
                search_string         = "/auth/"
                positional_constraint = "STARTS_WITH"
                field_to_match {
                  uri_path {}
                }
                text_transformation {
                  priority = 0
                  type     = "LOWERCASE"
                }
              }
            }
            statement {
              byte_match_statement {
                search_string         = "/login"
                positional_constraint = "STARTS_WITH"
                field_to_match {
                  uri_path {}
                }
                text_transformation {
                  priority = 0
                  type     = "LOWERCASE"
                }
              }
            }
            # Un registro con la CURP, el RFC o el teléfono de otra cuenta queda en revisión, y quien
            # verifica el correo lo ve (IDN-03): el límite por IP encarece esa enumeración. La Server
            # Action del BFF entra por aquí; la llamada del BFF a /auth/register va por el ALB
            # interno y WAF no la ve.
            statement {
              byte_match_statement {
                search_string         = "/register"
                positional_constraint = "STARTS_WITH"
                field_to_match {
                  uri_path {}
                }
                text_transformation {
                  priority = 0
                  type     = "LOWERCASE"
                }
              }
            }
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "auth-rate-limit"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "global-rate-limit"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit                 = var.global_rate_limit_per_5_minutes
        aggregate_key_type    = "IP"
        evaluation_window_sec = 300
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "global-rate-limit"
      sampled_requests_enabled   = true
    }
  }

  dynamic "rule" {
    for_each = {
      AWSManagedRulesAmazonIpReputationList = 10
      AWSManagedRulesCommonRuleSet          = 20
      AWSManagedRulesKnownBadInputsRuleSet  = 30
    }

    content {
      name     = rule.key
      priority = rule.value

      override_action {
        none {}
      }

      statement {
        managed_rule_group_statement {
          vendor_name = "AWS"
          name        = rule.key
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = rule.key
        sampled_requests_enabled   = true
      }
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = var.name_prefix
    sampled_requests_enabled   = true
  }
}

# El nombre del grupo debe empezar con aws-waf-logs-. Se ocultan los headers con credenciales.
resource "aws_cloudwatch_log_group" "waf" {
  provider = aws.us_east_1

  name              = "aws-waf-logs-${var.name_prefix}"
  retention_in_days = var.log_retention_days
}

resource "aws_wafv2_web_acl_logging_configuration" "this" {
  provider = aws.us_east_1

  resource_arn            = aws_wafv2_web_acl.this.arn
  log_destination_configs = [aws_cloudwatch_log_group.waf.arn]

  redacted_fields {
    single_header {
      name = "authorization"
    }
  }

  redacted_fields {
    single_header {
      name = "cookie"
    }
  }
}

# --- CloudFront ---

resource "aws_cloudfront_vpc_origin" "alb" {
  vpc_origin_endpoint_config {
    name                   = var.name_prefix
    arn                    = var.alb_arn
    http_port              = 80
    https_port             = 443
    origin_protocol_policy = "https-only"

    origin_ssl_protocols {
      items    = ["TLSv1.2"]
      quantity = 1
    }
  }
}

resource "aws_cloudfront_distribution" "this" {
  enabled         = true
  comment         = "TreoWallet ${var.name_prefix}: web y API"
  aliases         = [var.web_hostname, var.api_hostname]
  http_version    = "http2and3"
  is_ipv6_enabled = true
  price_class     = var.price_class
  web_acl_id      = aws_wafv2_web_acl.this.arn

  origin {
    origin_id   = "alb"
    domain_name = var.alb_dns_name

    vpc_origin_config {
      vpc_origin_id            = aws_cloudfront_vpc_origin.alb.id
      origin_keepalive_timeout = 5
      origin_read_timeout      = var.origin_read_timeout_seconds
    }
  }

  default_cache_behavior {
    target_origin_id           = "alb"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id   = data.aws_cloudfront_origin_request_policy.all_viewer.id
    response_headers_policy_id = data.aws_cloudfront_response_headers_policy.security_headers.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = var.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

# --- Registros públicos: los dos nombres apuntan a CloudFront ---

resource "aws_route53_record" "public" {
  for_each = {
    for pair in setproduct([var.web_hostname, var.api_hostname], ["A", "AAAA"]) :
    "${pair[0]}-${pair[1]}" => { name = pair[0], type = pair[1] }
  }

  zone_id = var.zone_id
  name    = each.value.name
  type    = each.value.type

  alias {
    name                   = aws_cloudfront_distribution.this.domain_name
    zone_id                = aws_cloudfront_distribution.this.hosted_zone_id
    evaluate_target_health = false
  }
}
