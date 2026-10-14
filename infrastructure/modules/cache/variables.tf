variable "name_prefix" {
  description = "Prefijo de los nombres, por ejemplo treo-prod."
  type        = string
}

variable "subnet_ids" {
  description = "Subredes de datos."
  type        = list(string)
}

variable "security_group_id" {
  description = "Grupo de seguridad de ElastiCache."
  type        = string
}

variable "kms_key_arn" {
  description = "Llave de datos: cifrado en reposo y secreto."
  type        = string
}

variable "logs_kms_key_arn" {
  description = "Llave de CloudWatch Logs."
  type        = string
}

variable "engine_version" {
  description = "Versión de Redis."
  type        = string
  default     = "7.1"
}

variable "node_type" {
  description = "Tipo de nodo."
  type        = string
}

variable "num_cache_clusters" {
  description = "Nodos (primario más réplicas). Con dos o más se activan failover automático y Multi-AZ."
  type        = number
  default     = 2
}

variable "snapshot_retention_days" {
  description = "Días de retención de los snapshots (0 los desactiva)."
  type        = number
  default     = 7
}

variable "auth_token_version" {
  description = "Versión del token. Aumentarla lo regenera."
  type        = number
  default     = 1
}

variable "secret_recovery_window_days" {
  description = "Días que el secreto borrado puede recuperarse (0 lo borra de inmediato)."
  type        = number
  default     = 30
}

variable "log_retention_days" {
  description = "Retención del slow log."
  type        = number
  default     = 90
}
