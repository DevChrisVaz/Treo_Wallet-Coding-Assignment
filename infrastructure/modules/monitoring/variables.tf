variable "name_prefix" {
  description = "Prefijo de los nombres, por ejemplo treo-prod."
  type        = string
}

variable "kms_key_arn" {
  description = "Llave de datos del tema SNS."
  type        = string
}

variable "alarm_emails" {
  description = "Correos suscritos a las alarmas (cada uno confirma la suscripción)."
  type        = list(string)
  default     = []
}

variable "api_log_group_name" {
  description = "Grupo de logs de la API."
  type        = string
}

variable "alb_arn_suffix" {
  description = "Sufijo del ARN del ALB."
  type        = string
}

variable "target_group_arn_suffixes" {
  description = "Sufijos de los grupos de destino, por nombre corto (api, web)."
  type        = map(string)
}

variable "cluster_name" {
  description = "Cluster de ECS."
  type        = string
}

variable "service_names" {
  description = "Servicios de ECS, por nombre corto (api, web)."
  type        = map(string)
}

variable "db_instance_identifier" {
  description = "Instancia de RDS."
  type        = string
}

variable "db_proxy_name" {
  description = "RDS Proxy."
  type        = string
}

variable "api_error_threshold" {
  description = "Errores de la API en 5 minutos antes de alarmar."
  type        = number
  default     = 5
}

variable "target_5xx_threshold" {
  description = "Respuestas 5xx en 5 minutos antes de alarmar."
  type        = number
  default     = 5
}

variable "api_latency_p99_seconds" {
  description = "Latencia p99 de la API antes de alarmar."
  type        = number
  default     = 2
}

variable "rds_min_free_storage_bytes" {
  description = "Almacenamiento libre mínimo de RDS."
  type        = number
  default     = 10737418240
}

variable "rds_max_connections_alarm" {
  description = "Conexiones a RDS a partir de las que se alarma."
  type        = number
  default     = 400
}
