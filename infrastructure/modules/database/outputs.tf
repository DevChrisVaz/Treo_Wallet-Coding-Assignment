output "instance_identifier" {
  description = "Identificador de la instancia (métricas de CloudWatch)."
  value       = aws_db_instance.this.identifier
}

output "address" {
  description = "Endpoint directo de RDS (migraciones y bootstrap)."
  value       = aws_db_instance.this.address
}

output "proxy_endpoint" {
  description = "Endpoint de RDS Proxy (API)."
  value       = aws_db_proxy.this.endpoint
}

output "proxy_name" {
  description = "Nombre de RDS Proxy (métricas de CloudWatch)."
  value       = aws_db_proxy.this.name
}

output "master_secret_arn" {
  description = "Secreto del superusuario (solo la tarea de bootstrap)."
  value       = aws_secretsmanager_secret.this["master"].arn
}

output "migrator_secret_arn" {
  description = "Secreto de wallet_migrator."
  value       = aws_secretsmanager_secret.this["migrator"].arn
}

output "app_secret_arn" {
  description = "Secreto de wallet_app."
  value       = aws_secretsmanager_secret.this["app"].arn
}
