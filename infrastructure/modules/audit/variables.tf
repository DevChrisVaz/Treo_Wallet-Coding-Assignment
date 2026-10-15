variable "name_prefix" {
  description = "Prefijo de los nombres, por ejemplo treo-prod."
  type        = string
}

variable "kms_key_arn" {
  description = "Llave de auditoría."
  type        = string
}

variable "object_lock_mode" {
  description = "COMPLIANCE en prod (nadie puede borrar antes del plazo); GOVERNANCE en dev y staging."
  type        = string

  validation {
    condition     = contains(["COMPLIANCE", "GOVERNANCE"], var.object_lock_mode)
    error_message = "object_lock_mode debe ser COMPLIANCE o GOVERNANCE."
  }
}

variable "retention_days" {
  description = "Plazo de retención por defecto de cada objeto. En prod lo fija el área de cumplimiento."
  type        = number

  validation {
    condition     = var.retention_days >= 1
    error_message = "retention_days debe ser al menos 1."
  }
}

variable "transition_to_glacier_days" {
  description = "Días antes de mover los objetos a Glacier Instant Retrieval."
  type        = number
  default     = 90
}
