variable "name_prefix" {
  description = "Prefijo de los nombres, por ejemplo treo-prod."
  type        = string
}

variable "region" {
  description = "Región principal."
  type        = string
}

variable "subnet_ids" {
  description = "Subredes privadas de las tareas."
  type        = list(string)
}

variable "api_security_group_id" {
  description = "Grupo de seguridad de la API."
  type        = string
}

variable "web_security_group_id" {
  description = "Grupo de seguridad del BFF."
  type        = string
}

variable "api_target_group_arn" {
  description = "Grupo de destino de la API."
  type        = string
}

variable "web_target_group_arn" {
  description = "Grupo de destino del BFF."
  type        = string
}

variable "alb_arn_suffix" {
  description = "Sufijo del ARN del ALB (métrica de peticiones por tarea)."
  type        = string
}

variable "api_target_group_arn_suffix" {
  description = "Sufijo del ARN del grupo de destino de la API."
  type        = string
}

variable "repository_urls" {
  description = "URL de los repositorios de ECR, por nombre corto (api, web)."
  type        = map(string)
}

variable "api_image_tag" {
  description = "Etiqueta de la imagen de la API que corre el servicio."
  type        = string
}

variable "migrations_image_tag" {
  description = "Etiqueta de la imagen de la API para migraciones y bootstrap; null usa la del servicio."
  type        = string
  default     = null
}

variable "web_image_tag" {
  description = "Etiqueta de la imagen del BFF."
  type        = string
}

variable "cpu_architecture" {
  description = "Arquitectura de las imágenes (X86_64 o ARM64)."
  type        = string
  default     = "X86_64"

  validation {
    condition     = contains(["X86_64", "ARM64"], var.cpu_architecture)
    error_message = "cpu_architecture debe ser X86_64 o ARM64."
  }
}

variable "use_fargate_spot" {
  description = "Fargate Spot para los servicios (solo dev: una tarea puede interrumpirse)."
  type        = bool
  default     = false
}

variable "api_port" {
  description = "Puerto del contenedor de la API."
  type        = number
}

variable "web_port" {
  description = "Puerto del contenedor del BFF."
  type        = number
}

variable "api_cpu" {
  description = "Unidades de CPU por tarea de la API (1024 = 1 vCPU)."
  type        = number
  default     = 512
}

variable "api_memory" {
  description = "Memoria por tarea de la API, en MiB."
  type        = number
  default     = 1024
}

variable "web_cpu" {
  description = "Unidades de CPU por tarea del BFF."
  type        = number
  default     = 512
}

variable "web_memory" {
  description = "Memoria por tarea del BFF, en MiB."
  type        = number
  default     = 1024
}

variable "api_min_count" {
  description = "Tareas mínimas de la API (al menos dos en zonas distintas fuera de dev)."
  type        = number
  default     = 2
}

variable "api_max_count" {
  description = <<-EOT
    Tareas máximas de la API. Sale de despejar la fórmula de la pregunta 1 de docs/aws-deploy.md
    (tareas_máximas × tamaño_del_pool + reserva ≤ max_connections), con el pool de 20 conexiones
    de wallet_app y el porcentaje de max_connections que puede usar RDS Proxy.
  EOT
  type        = number
  default     = 6
}

variable "web_min_count" {
  description = "Tareas mínimas del BFF."
  type        = number
  default     = 2
}

variable "web_max_count" {
  description = "Tareas máximas del BFF."
  type        = number
  default     = 6
}

variable "cpu_target_percent" {
  description = "CPU promedio objetivo del autoescalado."
  type        = number
  default     = 60
}

variable "api_requests_per_target" {
  description = "Peticiones por tarea de la API (por minuto) objetivo del autoescalado."
  type        = number
  default     = 1000
}

variable "wait_for_steady_state" {
  description = "terraform apply espera a que el servicio quede estable tras un despliegue."
  type        = bool
  default     = true
}

variable "api_log_level" {
  description = "LOG_LEVEL de la API."
  type        = string
  default     = "info"
}

variable "clabe_bank_code" {
  description = "CLABE_BANK_CODE de la API (3 dígitos)."
  type        = string
}

variable "clabe_plaza_code" {
  description = "CLABE_PLAZA_CODE de la API (3 dígitos)."
  type        = string
}

variable "smtp_host" {
  description = "Servidor SMTP (SES en la región)."
  type        = string
}

variable "smtp_from" {
  description = "Remitente de los correos, por ejemplo 'TreoWallet <no-reply@dominio>'."
  type        = string
}

variable "trusted_proxy_cidrs" {
  description = "TRUSTED_PROXIES de la API: rangos del ALB y del BFF (subredes privadas)."
  type        = list(string)
}

variable "api_extra_environment" {
  description = "Variables adicionales de la API (por ejemplo DAILY_TRANSFER_LIMIT). No van secretos aquí."
  type        = map(string)
  default     = {}
}

variable "api_base_url" {
  description = "API_BASE_URL del BFF: el nombre público de la API, que dentro de la VPC resuelve al ALB."
  type        = string
}

variable "web_allowed_origins" {
  description = "ALLOWED_ORIGINS del BFF: el dominio público (CloudFront cambia el Host hacia el origen)."
  type        = list(string)
}

variable "web_extra_environment" {
  description = "Variables adicionales del BFF. No van secretos aquí."
  type        = map(string)
  default     = {}
}

variable "migrations_command" {
  description = "Comando de la tarea de migraciones dentro de la imagen de la API."
  type        = list(string)
  default     = ["node", "dist/scripts/db-migrate.js"]
}

variable "bootstrap_command" {
  description = "Comando de la tarea de bootstrap dentro de la imagen de la API (necesita psql en la imagen)."
  type        = list(string)
  default     = ["node", "dist/scripts/db-bootstrap.js"]
}

variable "secrets" {
  description = "ARN de los secretos que reciben las tareas."
  type = object({
    database_master   = string
    database_migrator = string
    database_app      = string
    signing           = string
    smtp              = string
    cache             = string
  })
}

variable "data_kms_key_arn" {
  description = "Llave de datos (descifrar secretos e imágenes)."
  type        = string
}

variable "logs_kms_key_arn" {
  description = "Llave de CloudWatch Logs."
  type        = string
}

variable "log_retention_days" {
  description = "Retención de los logs de las tareas."
  type        = number
  default     = 90
}
