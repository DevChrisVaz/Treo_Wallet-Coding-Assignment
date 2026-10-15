variable "zone_id" {
  description = "Zona pública de Route 53 donde se crean los registros de validación."
  type        = string
}

variable "web_hostname" {
  description = "Nombre público de la web (BFF)."
  type        = string
}

variable "api_hostname" {
  description = "Nombre público de la API."
  type        = string
}
