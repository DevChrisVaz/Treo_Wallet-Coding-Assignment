# ElastiCache for Redis (docs/aws-deploy.md, sección 6): sesiones del BFF y contadores de rate
# limiting de la API, cifrado en tránsito y en reposo.
#
# Hoy ninguno de los dos proyectos lee REDIS_URL: la sesión vive en un Map y el rate limiting cuenta
# en memoria de cada tarea. El clúster queda listo para el cambio de código, y la URL ya llega a las
# tareas como secreto.

ephemeral "random_password" "auth_token" {
  length = 64
  # ElastiCache no admite caracteres especiales arbitrarios en el token; con solo alfanuméricos
  # tampoco hay que escaparlo dentro de la URL.
  special = false
}

resource "aws_elasticache_subnet_group" "this" {
  name       = var.name_prefix
  subnet_ids = var.subnet_ids
}

resource "aws_cloudwatch_log_group" "slow_log" {
  name              = "/treo/${var.name_prefix}/elasticache/slow-log"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.logs_kms_key_arn
}

resource "aws_elasticache_replication_group" "this" {
  replication_group_id = var.name_prefix
  description          = "Sesiones del BFF y rate limiting de la API (${var.name_prefix})"
  engine               = "redis"
  engine_version       = var.engine_version
  node_type            = var.node_type
  port                 = 6379

  num_cache_clusters         = var.num_cache_clusters
  automatic_failover_enabled = var.num_cache_clusters > 1
  multi_az_enabled           = var.num_cache_clusters > 1

  subnet_group_name  = aws_elasticache_subnet_group.this.name
  security_group_ids = [var.security_group_id]

  at_rest_encryption_enabled = true
  kms_key_id                 = var.kms_key_arn
  transit_encryption_enabled = true
  transit_encryption_mode    = "required"
  auth_token_wo              = ephemeral.random_password.auth_token.result
  auth_token_wo_version      = var.auth_token_version

  snapshot_retention_limit   = var.snapshot_retention_days
  snapshot_window            = "07:00-08:00"
  maintenance_window         = "sun:08:30-sun:09:30"
  auto_minor_version_upgrade = true
  apply_immediately          = false

  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.slow_log.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "slow-log"
  }
}

resource "aws_secretsmanager_secret" "this" {
  name                    = "${var.name_prefix}/cache"
  description             = "Token y URL de ElastiCache"
  kms_key_id              = var.kms_key_arn
  recovery_window_in_days = var.secret_recovery_window_days
}

resource "aws_secretsmanager_secret_version" "this" {
  secret_id = aws_secretsmanager_secret.this.id
  secret_string_wo = jsonencode({
    auth_token = ephemeral.random_password.auth_token.result
    url        = "rediss://:${ephemeral.random_password.auth_token.result}@${aws_elasticache_replication_group.this.primary_endpoint_address}:6379"
  })
  secret_string_wo_version = var.auth_token_version
}
