variable "environment" {
  description = "Ambiente: dev, staging o prod."
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment debe ser dev, staging o prod."
  }
}

variable "allowed_account_ids" {
  description = "Cuenta de AWS del ambiente."
  type        = list(string)
}

variable "region" {
  description = "Región del bucket de estado (la principal del ambiente)."
  type        = string
}

variable "github_repository" {
  description = "Repositorio de GitHub (dueño/nombre) cuyos workflows pueden asumir los roles."
  type        = string
  default     = "DevChrisVaz/Treo_Wallet-Coding-Assignment"
}
