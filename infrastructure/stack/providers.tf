locals {
  default_tags = {
    Project     = "treo-wallet"
    Environment = var.environment
    ManagedBy   = "terraform"
    Repository  = "DevChrisVaz/Treo_Wallet-Coding-Assignment"
  }
}

# allowed_account_ids evita aplicar el plan de un ambiente en la cuenta de otro.
provider "aws" {
  region              = var.region
  allowed_account_ids = var.allowed_account_ids

  default_tags {
    tags = local.default_tags
  }
}

# CloudFront solo acepta certificados de us-east-1, y el web ACL de WAF con alcance CLOUDFRONT vive ahí.
provider "aws" {
  alias               = "us_east_1"
  region              = "us-east-1"
  allowed_account_ids = var.allowed_account_ids

  default_tags {
    tags = local.default_tags
  }
}

# Región de recuperación: copia de los backups de RDS.
provider "aws" {
  alias               = "dr"
  region              = var.dr_region
  allowed_account_ids = var.allowed_account_ids

  default_tags {
    tags = local.default_tags
  }
}
