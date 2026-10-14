variable "name_prefix" {
  description = "Prefijo de los nombres, por ejemplo treo-prod."
  type        = string
}

variable "zone_id" {
  description = "Zona pública de Route 53."
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

variable "certificate_arn" {
  description = "Certificado de ACM emitido en us-east-1 para los dos nombres."
  type        = string
}

variable "alb_arn" {
  description = "ARN del ALB interno."
  type        = string
}

variable "alb_dns_name" {
  description = "Nombre DNS del ALB interno."
  type        = string
}

variable "price_class" {
  description = "Clase de precio de CloudFront. PriceClass_100 incluye Norteamérica."
  type        = string
  default     = "PriceClass_100"
}

variable "origin_read_timeout_seconds" {
  description = "Espera de CloudFront por la respuesta del ALB."
  type        = number
  default     = 60
}

variable "auth_rate_limit_per_5_minutes" {
  description = "Peticiones por IP en 5 minutos a /auth/* y /login antes de bloquear."
  type        = number
  default     = 100
}

variable "global_rate_limit_per_5_minutes" {
  description = "Peticiones por IP en 5 minutos a cualquier ruta antes de bloquear."
  type        = number
  default     = 2000
}

variable "log_retention_days" {
  description = "Retención de los logs de WAF."
  type        = number
  default     = 90
}
