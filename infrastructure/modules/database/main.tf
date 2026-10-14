# RDS for PostgreSQL 16 Multi-AZ con RDS Proxy (docs/aws-deploy.md, sección 2 y pregunta 1).
#
# Tres credenciales, cada una en su secreto (docs/aws-deploy.md, sección 1):
#   - master:          superusuario de RDS. Solo lo lee la tarea de bootstrap (`db:bootstrap`).
#   - wallet_migrator: dueño del esquema. Solo lo lee la tarea de migraciones, que entra directo a RDS.
#   - wallet_app:      rol de ejecución de la API. Entra por RDS Proxy.
#
# Las contraseñas son efímeras y se escriben en argumentos de solo escritura (`*_wo`): nunca quedan
# en el estado de Terraform. Se regeneran solo cuando cambia `credentials_version`; después hay que
# volver a correr la tarea de bootstrap, que reafirma las contraseñas de los roles con ALTER ROLE.

data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}

locals {
  master_username = "treo_admin"
  database_name   = "wallet"
  port            = 5432

  # Conexión directa a RDS: el certificado lo firma la CA de RDS, que la imagen debe incluir.
  direct_tls = "sslmode=verify-full&sslrootcert=${var.rds_ca_bundle_path}"
  # RDS Proxy presenta un certificado de ACM, de una CA pública que Node ya reconoce.
  proxy_tls = "sslmode=verify-full"
}

ephemeral "random_password" "master" {
  length = 40
  # Solo caracteres no reservados de URL: la contraseña viaja dentro de DATABASE_URL.
  override_special = "-_.~"
}

ephemeral "random_password" "migrator" {
  length           = 40
  override_special = "-_.~"
}

ephemeral "random_password" "app" {
  length           = 40
  override_special = "-_.~"
}

# --- Red y parámetros ---

resource "aws_db_subnet_group" "this" {
  name       = var.name_prefix
  subnet_ids = var.subnet_ids
}

resource "aws_db_parameter_group" "this" {
  name   = "${var.name_prefix}-postgres16"
  family = "postgres16"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  # Una transacción abierta y olvidada no retiene locks ni conexiones (pregunta 1). lock_timeout
  # y statement_timeout van por transacción en la API, no aquí.
  parameter {
    name  = "idle_in_transaction_session_timeout"
    value = tostring(var.idle_in_transaction_timeout_ms)
  }

  parameter {
    name  = "log_min_duration_statement"
    value = tostring(var.log_min_duration_statement_ms)
  }

  parameter {
    name  = "log_lock_waits"
    value = "1"
  }
}

data "aws_iam_policy_document" "monitoring_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["monitoring.rds.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "monitoring" {
  name               = "${var.name_prefix}-rds-monitoring"
  assume_role_policy = data.aws_iam_policy_document.monitoring_assume.json
}

resource "aws_iam_role_policy_attachment" "monitoring" {
  role       = aws_iam_role.monitoring.name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# --- Instancia ---

resource "aws_db_instance" "this" {
  identifier     = var.name_prefix
  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.instance_class
  port           = local.port

  allocated_storage     = var.allocated_storage_gb
  max_allocated_storage = var.max_allocated_storage_gb
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = var.kms_key_arn

  username            = local.master_username
  password_wo         = ephemeral.random_password.master.result
  password_wo_version = var.credentials_version

  multi_az               = var.multi_az
  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [var.security_group_id]
  publicly_accessible    = false
  parameter_group_name   = aws_db_parameter_group.this.name
  ca_cert_identifier     = "rds-ca-rsa2048-g1"

  backup_retention_period  = var.backup_retention_days
  backup_window            = "08:00-09:00"
  maintenance_window       = "sun:09:30-sun:10:30"
  copy_tags_to_snapshot    = true
  delete_automated_backups = false

  deletion_protection       = var.deletion_protection
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.name_prefix}-final"

  auto_minor_version_upgrade  = true
  allow_major_version_upgrade = false
  apply_immediately           = false

  performance_insights_enabled          = true
  performance_insights_kms_key_id       = var.kms_key_arn
  performance_insights_retention_period = 7
  monitoring_interval                   = 60
  monitoring_role_arn                   = aws_iam_role.monitoring.arn
  enabled_cloudwatch_logs_exports       = ["postgresql", "upgrade"]

  depends_on = [aws_iam_role_policy_attachment.monitoring]
}

# --- Secretos de conexión ---

locals {
  # El secreto de wallet_app debe existir antes que RDS Proxy (que lo lee), y su contenido después
  # (lleva el endpoint del proxy): los secretos y sus versiones se declaran por separado.
  secret_descriptions = {
    master   = "Superusuario de RDS: solo para db:bootstrap"
    migrator = "wallet_migrator: dueño del esquema, solo para migraciones"
    app      = "wallet_app: rol de ejecución de la API, por RDS Proxy"
  }

  connections = {
    master = {
      username = local.master_username
      host     = aws_db_instance.this.address
      dbname   = "postgres"
      tls      = local.direct_tls
    }
    migrator = {
      username = "wallet_migrator"
      host     = aws_db_instance.this.address
      dbname   = local.database_name
      tls      = local.direct_tls
    }
    app = {
      username = "wallet_app"
      host     = aws_db_proxy.this.endpoint
      dbname   = local.database_name
      tls      = local.proxy_tls
    }
  }

  passwords = {
    master   = ephemeral.random_password.master.result
    migrator = ephemeral.random_password.migrator.result
    app      = ephemeral.random_password.app.result
  }
}

resource "aws_secretsmanager_secret" "this" {
  for_each = local.secret_descriptions

  name                    = "${var.name_prefix}/database/${each.key}"
  description             = each.value
  kms_key_id              = var.kms_key_arn
  recovery_window_in_days = var.secret_recovery_window_days
}

# `username` y `password` son las llaves que lee RDS Proxy; `url` es la que reciben las tareas.
resource "aws_secretsmanager_secret_version" "this" {
  for_each = local.connections

  secret_id = aws_secretsmanager_secret.this[each.key].id
  secret_string_wo = jsonencode({
    engine   = "postgres"
    username = each.value.username
    password = local.passwords[each.key]
    host     = each.value.host
    port     = local.port
    dbname   = each.value.dbname
    url      = "postgres://${each.value.username}:${local.passwords[each.key]}@${each.value.host}:${local.port}/${each.value.dbname}?${each.value.tls}"
  })
  secret_string_wo_version = var.credentials_version
}

# --- RDS Proxy (solo wallet_app) ---

data "aws_iam_policy_document" "proxy_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["rds.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "proxy" {
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.this["app"].arn]
  }

  statement {
    actions   = ["kms:Decrypt"]
    resources = [var.kms_key_arn]
    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["secretsmanager.${var.region}.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "proxy" {
  name               = "${var.name_prefix}-rds-proxy"
  assume_role_policy = data.aws_iam_policy_document.proxy_assume.json
}

resource "aws_iam_role_policy" "proxy" {
  name   = "read-app-secret"
  role   = aws_iam_role.proxy.id
  policy = data.aws_iam_policy_document.proxy.json
}

resource "aws_db_proxy" "this" {
  name                   = var.name_prefix
  engine_family          = "POSTGRESQL"
  role_arn               = aws_iam_role.proxy.arn
  vpc_subnet_ids         = var.subnet_ids
  vpc_security_group_ids = [var.proxy_security_group_id]
  require_tls            = true
  idle_client_timeout    = 1800

  auth {
    description               = "wallet_app"
    auth_scheme               = "SECRETS"
    secret_arn                = aws_secretsmanager_secret.this["app"].arn
    iam_auth                  = "DISABLED"
    client_password_auth_type = "POSTGRES_SCRAM_SHA_256"
  }

  depends_on = [aws_iam_role_policy.proxy]
}

resource "aws_db_proxy_default_target_group" "this" {
  db_proxy_name = aws_db_proxy.this.name

  connection_pool_config {
    max_connections_percent      = var.proxy_max_connections_percent
    max_idle_connections_percent = 50
    # Menor que el timeout del ALB: una espera larga por conexión falla antes que la petición.
    connection_borrow_timeout = 30
  }
}

resource "aws_db_proxy_target" "this" {
  db_proxy_name          = aws_db_proxy.this.name
  target_group_name      = aws_db_proxy_default_target_group.this.name
  db_instance_identifier = aws_db_instance.this.identifier
}

# --- Exportación de audit_log a S3 con aws_s3.query_export_to_s3 (sección 5) ---

data "aws_iam_policy_document" "s3_export_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["rds.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

data "aws_iam_policy_document" "s3_export" {
  statement {
    actions   = ["s3:PutObject", "s3:AbortMultipartUpload"]
    resources = ["${var.audit_bucket_arn}/audit-log/*"]
  }

  statement {
    actions   = ["kms:GenerateDataKey", "kms:Decrypt"]
    resources = [var.audit_kms_key_arn]
  }
}

resource "aws_iam_role" "s3_export" {
  name               = "${var.name_prefix}-rds-s3-export"
  assume_role_policy = data.aws_iam_policy_document.s3_export_assume.json
}

resource "aws_iam_role_policy" "s3_export" {
  name   = "export-audit-log"
  role   = aws_iam_role.s3_export.id
  policy = data.aws_iam_policy_document.s3_export.json
}

resource "aws_db_instance_role_association" "s3_export" {
  db_instance_identifier = aws_db_instance.this.identifier
  feature_name           = "s3Export"
  role_arn               = aws_iam_role.s3_export.arn
}

# --- Copia de los backups automáticos a la región de recuperación (RPO ≤ 1 h ante pérdida de región) ---

resource "aws_kms_key" "dr" {
  count    = var.enable_cross_region_backups ? 1 : 0
  provider = aws.dr

  description             = "Backups de RDS de TreoWallet (${var.name_prefix}) en la región de recuperación"
  enable_key_rotation     = true
  deletion_window_in_days = 30
}

resource "aws_db_instance_automated_backups_replication" "this" {
  count    = var.enable_cross_region_backups ? 1 : 0
  provider = aws.dr

  source_db_instance_arn = aws_db_instance.this.arn
  kms_key_id             = aws_kms_key.dr[0].arn
  retention_period       = var.backup_retention_days
}
