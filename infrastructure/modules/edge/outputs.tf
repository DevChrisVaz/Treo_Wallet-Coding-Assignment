output "distribution_id" {
  description = "ID de la distribución de CloudFront."
  value       = aws_cloudfront_distribution.this.id
}

output "distribution_domain_name" {
  description = "Nombre de CloudFront (destino de los registros públicos)."
  value       = aws_cloudfront_distribution.this.domain_name
}

output "web_acl_arn" {
  description = "ARN del web ACL de WAF."
  value       = aws_wafv2_web_acl.this.arn
}
