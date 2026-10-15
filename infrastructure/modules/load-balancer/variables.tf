variable "name_prefix" {
  description = "Prefijo de los nombres, por ejemplo treo-prod."
  type        = string
}

variable "vpc_id" {
  description = "VPC del balanceador."
  type        = string
}

variable "subnet_ids" {
  description = "Subredes privadas del ALB interno."
  type        = list(string)
}

variable "security_group_id" {
  description = "Grupo de seguridad del ALB."
  type        = string
}

variable "certificate_arn" {
  description = "Certificado regional de ACM para los dos nombres."
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

variable "api_port" {
  description = "Puerto del contenedor de la API."
  type        = number
}

variable "web_port" {
  description = "Puerto del contenedor del BFF."
  type        = number
}

variable "web_sticky_sessions" {
  description = "Afinidad por cookie hacia el BFF mientras la sesión viva en memoria de cada tarea."
  type        = bool
  default     = true
}

variable "idle_timeout_seconds" {
  description = "Timeout de inactividad del ALB."
  type        = number
  default     = 60
}

variable "deletion_protection" {
  description = "Protección contra borrado del ALB."
  type        = bool
  default     = true
}

variable "access_log_retention_days" {
  description = "Días que se guardan los logs de acceso del ALB."
  type        = number
  default     = 90
}
