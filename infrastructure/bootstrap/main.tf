# Arranque de cada cuenta (una vez por ambiente, con credenciales de administrador):
#   - bucket de S3 para el estado de stack/, cifrado con su propia llave de KMS y con bloqueo nativo
#     de S3 (use_lockfile), sin tabla de DynamoDB.
#   - federación OIDC con GitHub Actions (docs/aws-deploy.md, sección 7): sin llaves de AWS de larga
#     duración en el repositorio.
#
# Este directorio guarda su propio estado en local (terraform.tfstate, fuera del repositorio): solo
# contiene el bucket, la llave y los roles, sin secretos.

data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}

locals {
  name_prefix = "treo-${var.environment}"
  account_id  = data.aws_caller_identity.current.account_id
  partition   = data.aws_partition.current.partition
}

# --- Estado remoto ---

data "aws_iam_policy_document" "state_key" {
  statement {
    sid       = "AccountAdministration"
    actions   = ["kms:*"]
    resources = ["*"]
    principals {
      type        = "AWS"
      identifiers = ["arn:${local.partition}:iam::${local.account_id}:root"]
    }
  }
}

resource "aws_kms_key" "state" {
  description             = "Estado de Terraform de TreoWallet (${local.name_prefix})"
  policy                  = data.aws_iam_policy_document.state_key.json
  enable_key_rotation     = true
  deletion_window_in_days = 30
}

resource "aws_kms_alias" "state" {
  name          = "alias/${local.name_prefix}-terraform-state"
  target_key_id = aws_kms_key.state.key_id
}

resource "aws_s3_bucket" "state" {
  bucket = "${local.name_prefix}-tfstate-${local.account_id}"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket = aws_s3_bucket.state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

# Versionado: un estado dañado o borrado se recupera de una versión anterior.
resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.state.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    id     = "versiones-anteriores"
    status = "Enabled"
    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 365
    }
  }

  depends_on = [aws_s3_bucket_versioning.state]
}

data "aws_iam_policy_document" "state_bucket" {
  statement {
    sid       = "DenyInsecureTransport"
    effect    = "Deny"
    actions   = ["s3:*"]
    resources = [aws_s3_bucket.state.arn, "${aws_s3_bucket.state.arn}/*"]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "state" {
  bucket = aws_s3_bucket.state.id
  policy = data.aws_iam_policy_document.state_bucket.json

  depends_on = [aws_s3_bucket_public_access_block.state]
}

# --- GitHub Actions por OIDC ---

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

# Dos roles por ambiente:
#   - plan:  lectura de la cuenta y del estado. Lo asumen los pull requests y el job de plan.
#   - apply: aplica cambios. Solo lo asume un job que corre en el GitHub Environment del ambiente,
#            que en prod exige aprobación manual y solo admite tags.
data "aws_iam_policy_document" "github_assume" {
  for_each = {
    plan  = ["repo:${var.github_repository}:pull_request", "repo:${var.github_repository}:environment:${var.environment}"]
    apply = ["repo:${var.github_repository}:environment:${var.environment}"]
  }

  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = each.value
    }
  }
}

resource "aws_iam_role" "github" {
  for_each = data.aws_iam_policy_document.github_assume

  name                 = "${local.name_prefix}-github-${each.key}"
  assume_role_policy   = each.value.json
  max_session_duration = 3600
}

# El plan lee la cuenta; además escribe el archivo de bloqueo del estado.
data "aws_iam_policy_document" "state_access" {
  statement {
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.state.arn]
  }

  statement {
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.state.arn}/*"]
  }

  statement {
    actions   = ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey"]
    resources = [aws_kms_key.state.arn]
  }
}

resource "aws_iam_role_policy" "state_access" {
  for_each = aws_iam_role.github

  name   = "terraform-state"
  role   = each.value.id
  policy = data.aws_iam_policy_document.state_access.json
}

resource "aws_iam_role_policy_attachment" "plan_read_only" {
  role       = aws_iam_role.github["plan"].name
  policy_arn = "arn:${local.partition}:iam::aws:policy/ReadOnlyAccess"
}

# Pendiente declarado: una política de mínimo privilegio para el apply (los servicios que crea
# stack/) en lugar de AdministratorAccess. Mientras tanto la protegen la condición de ambiente y la
# aprobación manual de GitHub.
resource "aws_iam_role_policy_attachment" "apply_admin" {
  role       = aws_iam_role.github["apply"].name
  policy_arn = "arn:${local.partition}:iam::aws:policy/AdministratorAccess"
}
