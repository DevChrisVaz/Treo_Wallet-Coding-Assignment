variable "name_prefix" {
  description = "Prefijo de los nombres, por ejemplo treo-prod."
  type        = string
}

variable "deletion_window_in_days" {
  description = "Días de espera antes de borrar una llave programada para borrado."
  type        = number
  default     = 30
}
