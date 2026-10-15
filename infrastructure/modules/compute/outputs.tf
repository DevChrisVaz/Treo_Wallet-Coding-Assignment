output "cluster_name" {
  description = "Nombre del cluster de ECS."
  value       = aws_ecs_cluster.this.name
}

output "service_names" {
  description = "Servicios de ECS, por nombre corto (api, web)."
  value       = { for key, service in aws_ecs_service.this : key => service.name }
}

output "task_definition_families" {
  description = "Familias de las definiciones de tarea, por nombre corto."
  value       = { for key, task in aws_ecs_task_definition.this : key => task.family }
}

output "log_group_names" {
  description = "Grupos de logs de las tareas, por nombre corto."
  value       = { for key, group in aws_cloudwatch_log_group.this : key => group.name }
}
