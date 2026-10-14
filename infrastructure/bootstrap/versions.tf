terraform {
  required_version = ">= 1.11"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region              = var.region
  allowed_account_ids = var.allowed_account_ids

  default_tags {
    tags = {
      Project     = "treo-wallet"
      Environment = var.environment
      ManagedBy   = "terraform"
      Repository  = "DevChrisVaz/Treo_Wallet-Coding-Assignment"
    }
  }
}
