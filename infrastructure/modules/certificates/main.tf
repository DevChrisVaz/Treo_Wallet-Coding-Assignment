# Certificados de ACM para los dos nombres públicos (web y API), validados por DNS en la zona
# pública de Route 53:
#   - regional: lo presenta el ALB interno a CloudFront y al BFF.
#   - global:   lo presenta CloudFront al navegador y a la app móvil; CloudFront solo acepta
#               certificados emitidos en us-east-1.

locals {
  names = [var.web_hostname, var.api_hostname]
}

resource "aws_acm_certificate" "regional" {
  domain_name               = local.names[0]
  subject_alternative_names = slice(local.names, 1, length(local.names))
  validation_method         = "DNS"
  key_algorithm             = "RSA_2048"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_acm_certificate" "global" {
  provider = aws.us_east_1

  domain_name               = local.names[0]
  subject_alternative_names = slice(local.names, 1, length(local.names))
  validation_method         = "DNS"
  key_algorithm             = "RSA_2048"

  lifecycle {
    create_before_destroy = true
  }
}

locals {
  # Las llaves salen de los nombres configurados, no de los atributos que ACM calcula, para que el
  # for_each se conozca en el plan. ACM puede pedir el mismo registro para los dos certificados;
  # allow_overwrite lo tolera.
  validation_records = merge(
    {
      for name in local.names : "regional-${name}" => one([
        for o in aws_acm_certificate.regional.domain_validation_options : o if o.domain_name == name
      ])
    },
    {
      for name in local.names : "global-${name}" => one([
        for o in aws_acm_certificate.global.domain_validation_options : o if o.domain_name == name
      ])
    },
  )
}

resource "aws_route53_record" "validation" {
  for_each = local.validation_records

  zone_id         = var.zone_id
  name            = each.value.resource_record_name
  type            = each.value.resource_record_type
  records         = [each.value.resource_record_value]
  ttl             = 300
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "regional" {
  certificate_arn = aws_acm_certificate.regional.arn
  validation_record_fqdns = [
    for key, record in aws_route53_record.validation : record.fqdn if startswith(key, "regional-")
  ]
}

resource "aws_acm_certificate_validation" "global" {
  provider = aws.us_east_1

  certificate_arn = aws_acm_certificate.global.arn
  validation_record_fqdns = [
    for key, record in aws_route53_record.validation : record.fqdn if startswith(key, "global-")
  ]
}
