variable "name_prefix" {
  description = "Prefijo de los nombres, por ejemplo treo-prod."
  type        = string
}

variable "region" {
  description = "Región principal (condición kms:ViaService del rol de RDS Proxy)."
  type        = string
}

variable "subnet_ids" {
  description = "Subredes de datos de RDS y RDS Proxy."
  type        = list(string)
}

variable "security_group_id" {
  description = "Grupo de seguridad de RDS."
  type        = string
}

variable "proxy_security_group_id" {
  description = "Grupo de seguridad de RDS Proxy."
  type        = string
}

variable "kms_key_arn" {
  description = "Llave de datos: almacenamiento, Performance Insights y secretos."
  type        = string
}

variable "engine_version" {
  description = "Versión de PostgreSQL. La misma mayor que el entorno local y el CI."
  type        = string
  default     = "16"
}

variable "instance_class" {
  description = "Clase de la instancia."
  type        = string
}

variable "allocated_storage_gb" {
  description = "Almacenamiento inicial."
  type        = number
  default     = 50
}

variable "max_allocated_storage_gb" {
  description = "Tope del autoescalado de almacenamiento."
  type        = number
  default     = 500
}

variable "multi_az" {
  description = "Standby síncrono en otra zona con failover automático."
  type        = bool
  default     = true
}

variable "backup_retention_days" {
  description = "Retención de los backups automáticos (PITR)."
  type        = number
  default     = 35

  validation {
    condition     = var.backup_retention_days >= 1 && var.backup_retention_days <= 35
    error_message = "backup_retention_days debe estar entre 1 y 35."
  }
}

variable "deletion_protection" {
  description = "Protección contra borrado."
  type        = bool
  default     = true
}

variable "credentials_version" {
  description = "Versión de las contraseñas. Aumentarla las regenera; después se corre la tarea de bootstrap."
  type        = number
  default     = 1
}

variable "secret_recovery_window_days" {
  description = "Días que un secreto borrado puede recuperarse (0 lo borra de inmediato)."
  type        = number
  default     = 30
}

variable "rds_ca_bundle_path" {
  description = "Ruta, dentro de la imagen de la API, del bundle de CAs de RDS para verificar la conexión directa."
  type        = string
  default     = "/etc/ssl/certs/rds-global-bundle.pem"
}

variable "idle_in_transaction_timeout_ms" {
  description = "idle_in_transaction_session_timeout de PostgreSQL."
  type        = number
  default     = 60000
}

variable "log_min_duration_statement_ms" {
  description = "Consultas más lentas que esto se registran."
  type        = number
  default     = 1000
}

variable "proxy_max_connections_percent" {
  description = "Porcentaje de max_connections que puede usar RDS Proxy; el resto es la reserva para migraciones y administración."
  type        = number
  default     = 80
}

variable "audit_bucket_arn" {
  description = "Bucket de auditoría al que se exporta audit_log."
  type        = string
}

variable "audit_kms_key_arn" {
  description = "Llave del bucket de auditoría."
  type        = string
}

variable "enable_cross_region_backups" {
  description = "Replica los backups automáticos a la región de recuperación."
  type        = bool
  default     = false
}
