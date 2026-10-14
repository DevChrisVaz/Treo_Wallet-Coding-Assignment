output "data_key_arn" {
  description = "ARN de la llave de datos."
  value       = aws_kms_key.this["data"].arn
}

output "logs_key_arn" {
  description = "ARN de la llave de CloudWatch Logs."
  value       = aws_kms_key.this["logs"].arn
}

output "audit_key_arn" {
  description = "ARN de la llave de auditoría."
  value       = aws_kms_key.this["audit"].arn
}
