# --- Ambiente y cuenta ---

variable "environment" {
  description = "Ambiente: dev, staging o prod. Cada uno en su propia cuenta de AWS."
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment debe ser dev, staging o prod."
  }
}

variable "allowed_account_ids" {
  description = "Cuenta de AWS del ambiente. Terraform se niega a operar en otra."
  type        = list(string)
}

variable "region" {
  description = "Región principal."
  type        = string
}

variable "dr_region" {
  description = "Región de recuperación ante desastres (copia de backups de RDS)."
  type        = string
}

# --- Dominio ---

variable "domain_name" {
  description = "Zona pública de Route 53 del ambiente (ya existente), por ejemplo dev.treowallet.example."
  type        = string
}

variable "web_subdomain" {
  description = "Subdominio de la web (BFF)."
  type        = string
  default     = "web"
}

variable "api_subdomain" {
  description = "Subdominio de la API."
  type        = string
  default     = "api"
}

# --- Red ---

variable "vpc_cidr" {
  description = "Rango /16 de la VPC."
  type        = string
}

variable "az_count" {
  description = "Zonas de disponibilidad."
  type        = number
  default     = 2
}

variable "single_nat_gateway" {
  description = "Un solo NAT Gateway (solo dev)."
  type        = bool
  default     = false
}

variable "enable_interface_endpoints" {
  description = "Endpoints de interfaz para ECR, Logs, Secrets Manager, KMS y STS."
  type        = bool
  default     = true
}

# --- Base de datos ---

variable "db_instance_class" {
  description = "Clase de la instancia de RDS."
  type        = string
}

variable "db_multi_az" {
  description = "RDS Multi-AZ."
  type        = bool
  default     = true
}

variable "db_backup_retention_days" {
  description = "Retención de backups automáticos (PITR)."
  type        = number
  default     = 35
}

variable "db_deletion_protection" {
  description = "Protección contra borrado de RDS y del ALB."
  type        = bool
  default     = true
}

variable "enable_cross_region_backups" {
  description = "Copia de los backups de RDS a dr_region."
  type        = bool
  default     = false
}

variable "db_credentials_version" {
  description = "Versión de las contraseñas de la base. Aumentarla las rota (después, tarea de bootstrap)."
  type        = number
  default     = 1
}

# --- Caché ---

variable "cache_node_type" {
  description = "Tipo de nodo de ElastiCache."
  type        = string
}

variable "cache_num_nodes" {
  description = "Nodos de ElastiCache (dos o más: failover automático)."
  type        = number
  default     = 2
}

variable "cache_auth_token_version" {
  description = "Versión del token de ElastiCache. Aumentarla lo rota."
  type        = number
  default     = 1
}

# --- Aplicación ---

variable "api_image_tag" {
  description = "Etiqueta de la imagen de la API en ECR."
  type        = string
}

variable "migrations_image_tag" {
  description = "Etiqueta de la imagen para migraciones y bootstrap; null usa api_image_tag."
  type        = string
  default     = null
}

variable "web_image_tag" {
  description = "Etiqueta de la imagen del BFF en ECR."
  type        = string
}

variable "cpu_architecture" {
  description = "Arquitectura de las imágenes."
  type        = string
  default     = "X86_64"
}

variable "use_fargate_spot" {
  description = "Fargate Spot (solo dev)."
  type        = bool
  default     = false
}

variable "api_cpu" {
  description = "CPU por tarea de la API."
  type        = number
  default     = 512
}

variable "api_memory" {
  description = "Memoria por tarea de la API (MiB)."
  type        = number
  default     = 1024
}

variable "api_min_count" {
  description = "Tareas mínimas de la API."
  type        = number
  default     = 2
}

variable "api_max_count" {
  description = "Tareas máximas de la API (ver la fórmula de conexiones en docs/aws-deploy.md)."
  type        = number
  default     = 6
}

variable "web_cpu" {
  description = "CPU por tarea del BFF."
  type        = number
  default     = 512
}

variable "web_memory" {
  description = "Memoria por tarea del BFF (MiB)."
  type        = number
  default     = 1024
}

variable "web_min_count" {
  description = "Tareas mínimas del BFF."
  type        = number
  default     = 2
}

variable "web_max_count" {
  description = "Tareas máximas del BFF."
  type        = number
  default     = 6
}

variable "clabe_bank_code" {
  description = "CLABE_BANK_CODE de la API. 999 no corresponde a ninguna institución: en prod va la clave asignada."
  type        = string
}

variable "clabe_plaza_code" {
  description = "CLABE_PLAZA_CODE de la API."
  type        = string
}

variable "api_extra_environment" {
  description = "Variables adicionales de la API (límites, OTP, programadas). Nunca secretos."
  type        = map(string)
  default     = {}
}

variable "signing_secrets_version" {
  description = "Versión de JWT_SECRET, OTP_HMAC_SECRET y CURSOR_SIGNING_SECRET. Aumentarla los rota y cierra las sesiones."
  type        = number
  default     = 1
}

# --- Correo ---

variable "mail_from_name" {
  description = "Nombre del remitente de los correos."
  type        = string
  default     = "TreoWallet"
}

variable "dmarc_report_address" {
  description = "Buzón de los reportes agregados de DMARC."
  type        = string
}

# --- Auditoría y operación ---

variable "audit_object_lock_mode" {
  description = "COMPLIANCE en prod; GOVERNANCE en dev y staging."
  type        = string
}

variable "audit_retention_days" {
  description = "Plazo de Object Lock del bucket de auditoría. En prod lo fija el área de cumplimiento: sin valor por defecto."
  type        = number
}

variable "alarm_emails" {
  description = "Correos suscritos a las alarmas."
  type        = list(string)
  default     = []
}

variable "log_retention_days" {
  description = "Retención de CloudWatch Logs."
  type        = number
  default     = 90
}

variable "secret_recovery_window_days" {
  description = "Días que un secreto borrado puede recuperarse (0 en dev para recrear el ambiente)."
  type        = number
  default     = 30
}
