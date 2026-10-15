variable "name_prefix" {
  description = "Prefijo de los nombres, por ejemplo treo-prod."
  type        = string
}

variable "cidr_block" {
  description = "Rango de la VPC. Debe ser /16 para que quepan las tres capas de subredes."
  type        = string

  validation {
    condition     = can(cidrhost(var.cidr_block, 0)) && endswith(var.cidr_block, "/16")
    error_message = "cidr_block debe ser un rango IPv4 /16."
  }
}

variable "az_count" {
  description = "Zonas de disponibilidad (al menos dos, para Multi-AZ y para el ALB)."
  type        = number
  default     = 2

  validation {
    condition     = var.az_count >= 2 && var.az_count <= 3
    error_message = "az_count debe ser 2 o 3."
  }
}

variable "excluded_zone_ids" {
  description = "IDs de zona que no se usan. Por defecto, las excepciones de VPC origins de CloudFront (guía de CloudFront, \"Supported AWS Regions for VPC origins\")."
  type        = list(string)
  default     = ["use1-az3", "usw1-az2", "apne1-az3", "cac1-az3"]
}

variable "single_nat_gateway" {
  description = "Un solo NAT Gateway para toda la VPC (ahorro en dev). En prod, uno por zona."
  type        = bool
  default     = false
}

variable "enable_interface_endpoints" {
  description = "Crea endpoints de interfaz para ECR, CloudWatch Logs, Secrets Manager, KMS y STS."
  type        = bool
  default     = true
}

variable "interface_endpoint_services" {
  description = "Servicios con endpoint de interfaz."
  type        = list(string)
  default     = ["ecr.api", "ecr.dkr", "logs", "secretsmanager", "kms", "sts"]
}

variable "logs_kms_key_arn" {
  description = "Llave de KMS de CloudWatch Logs."
  type        = string
}

variable "log_retention_days" {
  description = "Retención de los flow logs."
  type        = number
  default     = 90
}
