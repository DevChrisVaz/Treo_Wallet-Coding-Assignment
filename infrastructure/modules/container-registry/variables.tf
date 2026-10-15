variable "name_prefix" {
  description = "Prefijo de los nombres, por ejemplo treo-prod."
  type        = string
}

variable "repositories" {
  description = "Repositorios a crear."
  type        = list(string)
  default     = ["api", "web"]
}

variable "kms_key_arn" {
  description = "Llave de datos para cifrar las imágenes."
  type        = string
}

variable "images_to_keep" {
  description = "Imágenes etiquetadas que se conservan por repositorio."
  type        = number
  default     = 30
}
