output "smtp_host" {
  description = "Servidor SMTP de SES en la región."
  value       = "email-smtp.${data.aws_region.current.region}.amazonaws.com"
}

output "smtp_secret_arn" {
  description = "Secreto con las llaves user y password."
  value       = aws_secretsmanager_secret.smtp.arn
}

output "configuration_set_name" {
  description = "Configuration set de SES (dimensión de las métricas)."
  value       = aws_sesv2_configuration_set.this.configuration_set_name
}
