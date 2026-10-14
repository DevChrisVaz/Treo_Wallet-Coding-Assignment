variable "name_prefix" {
  description = "Prefijo de los nombres, por ejemplo treo-prod."
  type        = string
}

variable "kms_key_arn" {
  description = "Llave de datos."
  type        = string
}

variable "secrets_version" {
  description = "Versión de los secretos. Aumentarla los regenera (y cierra todas las sesiones)."
  type        = number
  default     = 1
}

variable "secret_recovery_window_days" {
  description = "Días que el secreto borrado puede recuperarse (0 lo borra de inmediato)."
  type        = number
  default     = 30
}
