# Llaves de KMS administradas por el cliente (docs/aws-deploy.md, sección 6). Tres llaves con
# propósitos distintos para que revocar una no afecte a las otras:
#   - data:  RDS, ElastiCache, Secrets Manager, ECR, Performance Insights y el tema SNS de alarmas.
#   - logs:  grupos de CloudWatch Logs (el servicio de logs necesita permisos explícitos).
#   - audit: el bucket de auditoría (audit_log exportado y CloudTrail).

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
data "aws_partition" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.region
  partition  = data.aws_partition.current.partition
  root_arn   = "arn:${local.partition}:iam::${local.account_id}:root"
}

# La cuenta administra la llave por IAM: sin esta declaración la llave queda inmanejable.
data "aws_iam_policy_document" "account_admin" {
  statement {
    sid       = "AccountAdministration"
    actions   = ["kms:*"]
    resources = ["*"]
    principals {
      type        = "AWS"
      identifiers = [local.root_arn]
    }
  }
}

data "aws_iam_policy_document" "data" {
  source_policy_documents = [data.aws_iam_policy_document.account_admin.json]

  # CloudWatch publica las alarmas en el tema SNS cifrado con esta llave.
  statement {
    sid       = "CloudWatchAlarmsToEncryptedSns"
    actions   = ["kms:Decrypt", "kms:GenerateDataKey*"]
    resources = ["*"]
    principals {
      type        = "Service"
      identifiers = ["cloudwatch.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [local.account_id]
    }
  }
}

data "aws_iam_policy_document" "logs" {
  source_policy_documents = [data.aws_iam_policy_document.account_admin.json]

  statement {
    sid       = "CloudWatchLogs"
    actions   = ["kms:Encrypt", "kms:Decrypt", "kms:ReEncrypt*", "kms:GenerateDataKey*", "kms:Describe*"]
    resources = ["*"]
    principals {
      type        = "Service"
      identifiers = ["logs.${local.region}.amazonaws.com"]
    }
    condition {
      test     = "ArnLike"
      variable = "kms:EncryptionContext:aws:logs:arn"
      values   = ["arn:${local.partition}:logs:${local.region}:${local.account_id}:log-group:*"]
    }
  }
}

data "aws_iam_policy_document" "audit" {
  source_policy_documents = [data.aws_iam_policy_document.account_admin.json]

  statement {
    sid       = "CloudTrailEncryptLogs"
    actions   = ["kms:GenerateDataKey*"]
    resources = ["*"]
    principals {
      type        = "Service"
      identifiers = ["cloudtrail.amazonaws.com"]
    }
    condition {
      test     = "StringLike"
      variable = "kms:EncryptionContext:aws:cloudtrail:arn"
      values   = ["arn:${local.partition}:cloudtrail:*:${local.account_id}:trail/*"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [local.account_id]
    }
  }

  statement {
    sid       = "CloudTrailDescribeKey"
    actions   = ["kms:DescribeKey"]
    resources = ["*"]
    principals {
      type        = "Service"
      identifiers = ["cloudtrail.amazonaws.com"]
    }
  }
}

locals {
  keys = {
    data  = { description = "Datos de TreoWallet (${var.name_prefix}): RDS, ElastiCache, secretos, ECR y SNS", policy = data.aws_iam_policy_document.data.json }
    logs  = { description = "CloudWatch Logs de TreoWallet (${var.name_prefix})", policy = data.aws_iam_policy_document.logs.json }
    audit = { description = "Auditoría de TreoWallet (${var.name_prefix}): audit_log exportado y CloudTrail", policy = data.aws_iam_policy_document.audit.json }
  }
}

resource "aws_kms_key" "this" {
  for_each = local.keys

  description             = each.value.description
  policy                  = each.value.policy
  enable_key_rotation     = true
  deletion_window_in_days = var.deletion_window_in_days
}

resource "aws_kms_alias" "this" {
  for_each = local.keys

  name          = "alias/${var.name_prefix}-${each.key}"
  target_key_id = aws_kms_key.this[each.key].key_id
}
