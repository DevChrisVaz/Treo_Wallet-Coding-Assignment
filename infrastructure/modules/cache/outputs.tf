output "replication_group_id" {
  description = "ID del grupo de replicación (métricas de CloudWatch)."
  value       = aws_elasticache_replication_group.this.id
}

output "primary_endpoint_address" {
  description = "Endpoint primario."
  value       = aws_elasticache_replication_group.this.primary_endpoint_address
}

output "secret_arn" {
  description = "Secreto con el token y la URL."
  value       = aws_secretsmanager_secret.this.arn
}
