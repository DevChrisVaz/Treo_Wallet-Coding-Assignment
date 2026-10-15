variable "name_prefix" {
  description = "Prefijo de los nombres, por ejemplo treo-prod."
  type        = string
}

variable "zone_id" {
  description = "Zona pública de Route 53 del dominio de envío."
  type        = string
}

variable "domain_name" {
  description = "Dominio desde el que se envían los correos."
  type        = string
}

variable "dmarc_policy" {
  description = "Política DMARC: none mientras se observan los reportes, después quarantine o reject."
  type        = string
  default     = "quarantine"

  validation {
    condition     = contains(["none", "quarantine", "reject"], var.dmarc_policy)
    error_message = "dmarc_policy debe ser none, quarantine o reject."
  }
}

variable "dmarc_report_address" {
  description = "Buzón que recibe los reportes agregados de DMARC."
  type        = string
}

variable "kms_key_arn" {
  description = "Llave de datos del secreto SMTP."
  type        = string
}

variable "secret_recovery_window_days" {
  description = "Días que el secreto borrado puede recuperarse (0 lo borra de inmediato)."
  type        = number
  default     = 30
}
