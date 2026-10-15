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

variable "allow_pull_request_plan" {
  description = "Permite que los pull requests asuman el rol de plan. Quien abre un PR podría leer el estado, que incluye la credencial SMTP de SES; nunca en prod."
  type        = bool
  default     = false

  validation {
    condition     = !(var.allow_pull_request_plan && var.environment == "prod")
    error_message = "allow_pull_request_plan no se permite en prod."
  }
}

variable "github_repository" {
  description = "Repositorio de GitHub (dueño/nombre) cuyos workflows pueden asumir los roles."
  type        = string
  default     = "DevChrisVaz/Treo_Wallet-Coding-Assignment"
}
