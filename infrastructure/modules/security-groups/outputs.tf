output "alb_id" {
  description = "Grupo del ALB."
  value       = local.sg["alb"]
}

output "api_id" {
  description = "Grupo de las tareas de la API."
  value       = local.sg["api"]
}

output "web_id" {
  description = "Grupo de las tareas del BFF."
  value       = local.sg["web"]
}

output "migrations_id" {
  description = "Grupo de las tareas puntuales de la base."
  value       = local.sg["migrations"]
}

output "rds_proxy_id" {
  description = "Grupo de RDS Proxy."
  value       = local.sg["rds_proxy"]
}

output "database_id" {
  description = "Grupo de RDS."
  value       = local.sg["database"]
}

output "cache_id" {
  description = "Grupo de ElastiCache."
  value       = local.sg["cache"]
}
