output "web_url" {
  description = "URL pública de la web."
  value       = "https://${local.web_hostname}"
}

output "api_url" {
  description = "URL pública de la API (EXPO_PUBLIC_API_URL de la app móvil)."
  value       = "https://${local.api_hostname}"
}

output "ecr_repository_urls" {
  description = "Repositorios de ECR donde CI sube las imágenes."
  value       = module.container_registry.repository_urls
}

output "ecs_cluster_name" {
  description = "Cluster de ECS."
  value       = module.compute.cluster_name
}

output "ecs_service_names" {
  description = "Servicios de ECS (api, web)."
  value       = module.compute.service_names
}

output "ecs_task_definition_families" {
  description = "Familias de tarea; migrations y bootstrap se corren con aws ecs run-task."
  value       = module.compute.task_definition_families
}

# Lo que necesita `aws ecs run-task` para las tareas puntuales de la base.
output "database_task_network" {
  description = "Subredes y grupo de seguridad de las tareas de migraciones y bootstrap."
  value = {
    subnets         = module.network.private_subnet_ids
    security_groups = [module.security_groups.migrations_id]
  }
}

output "cloudfront_distribution_id" {
  description = "Distribución de CloudFront."
  value       = module.edge.distribution_id
}

output "audit_bucket_name" {
  description = "Bucket de auditoría con Object Lock."
  value       = module.audit.bucket_name
}

output "alarm_topic_arn" {
  description = "Tema SNS de las alarmas."
  value       = module.monitoring.alarm_topic_arn
}
