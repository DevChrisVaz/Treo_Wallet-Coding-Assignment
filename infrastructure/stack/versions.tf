terraform {
  # Argumentos de solo escritura (`*_wo`) y recursos efímeros: las contraseñas no quedan en el estado.
  required_version = ">= 1.11"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7"
    }
  }

  # Configuración parcial: bucket, llave y región vienen de environments/<ambiente>.s3.tfbackend.
  backend "s3" {}
}
