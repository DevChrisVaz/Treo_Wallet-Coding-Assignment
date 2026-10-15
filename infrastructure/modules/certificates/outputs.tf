output "regional_certificate_arn" {
  description = "Certificado validado de la región principal (ALB)."
  value       = aws_acm_certificate_validation.regional.certificate_arn
}

output "global_certificate_arn" {
  description = "Certificado validado de us-east-1 (CloudFront)."
  value       = aws_acm_certificate_validation.global.certificate_arn
}
