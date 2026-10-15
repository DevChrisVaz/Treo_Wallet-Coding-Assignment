variable "name_prefix" {
  description = "Prefijo de los nombres, por ejemplo treo-prod."
  type        = string
}

variable "vpc_id" {
  description = "VPC de los grupos."
  type        = string
}

variable "api_port" {
  description = "Puerto del contenedor de la API."
  type        = number
}

variable "web_port" {
  description = "Puerto del contenedor del BFF."
  type        = number
}
