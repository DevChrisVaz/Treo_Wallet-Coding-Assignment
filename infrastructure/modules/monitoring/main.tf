# Métricas y alarmas (docs/aws-deploy.md, sección 5). Todas notifican al mismo tema SNS.
#
# Además de las métricas de AWS, tres filtros convierten en métricas los logs JSON de la API
# (pino, campos `level` y `msg`):
#   - errores:            `level` = "error" (incluye los 5xx de request-logger).
#   - alertas de la base: `alert` = true; lo marca pg-errors para 42501 (permiso), 40P01 y 40001.
#   - correos fallidos:   `msg` = "mail delivery failed" (los OTP son críticos: alarma obligatoria).

locals {
  namespace = "Treo/${var.name_prefix}"

  log_metrics = {
    ApiErrors = {
      pattern   = "{ $.level = \"error\" }"
      threshold = var.api_error_threshold
      summary   = "Errores registrados por la API"
    }
    DatabaseAlerts = {
      pattern   = "{ $.alert IS TRUE }"
      threshold = 0
      summary   = "Errores de permiso (42501), deadlocks o fallas de serialización en PostgreSQL"
    }
    MailDeliveryFailures = {
      pattern   = "{ $.msg = \"mail delivery failed\" }"
      threshold = 0
      summary   = "Correos que la API no pudo enviar (OTP, verificación, avisos)"
    }
  }
}

resource "aws_sns_topic" "alarms" {
  name              = "${var.name_prefix}-alarms"
  kms_master_key_id = var.kms_key_arn
}

resource "aws_sns_topic_subscription" "email" {
  for_each = toset(var.alarm_emails)

  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = each.value
}

# --- Métricas desde los logs de la API ---

resource "aws_cloudwatch_log_metric_filter" "api" {
  for_each = local.log_metrics

  name           = "${var.name_prefix}-${each.key}"
  log_group_name = var.api_log_group_name
  pattern        = each.value.pattern

  metric_transformation {
    name          = each.key
    namespace     = local.namespace
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_metric_alarm" "api_logs" {
  for_each = local.log_metrics

  alarm_name          = "${var.name_prefix}-${each.key}"
  alarm_description   = each.value.summary
  namespace           = local.namespace
  metric_name         = each.key
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  comparison_operator = "GreaterThanThreshold"
  threshold           = each.value.threshold
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]

  depends_on = [aws_cloudwatch_log_metric_filter.api]
}

# --- ALB: 5xx, latencia y destinos sanos, por servicio ---

resource "aws_cloudwatch_metric_alarm" "target_5xx" {
  for_each = var.target_group_arn_suffixes

  alarm_name          = "${var.name_prefix}-${each.key}-5xx"
  alarm_description   = "Respuestas 5xx del servicio ${each.key}"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_Target_5XX_Count"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  comparison_operator = "GreaterThanThreshold"
  threshold           = var.target_5xx_threshold
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
    TargetGroup  = each.value
  }
}

resource "aws_cloudwatch_metric_alarm" "unhealthy_hosts" {
  for_each = var.target_group_arn_suffixes

  alarm_name          = "${var.name_prefix}-${each.key}-unhealthy"
  alarm_description   = "Tareas de ${each.key} fuera de servicio en el ALB"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "UnHealthyHostCount"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 3
  comparison_operator = "GreaterThanThreshold"
  threshold           = 0
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
    TargetGroup  = each.value
  }
}

resource "aws_cloudwatch_metric_alarm" "api_latency" {
  alarm_name          = "${var.name_prefix}-api-latency-p99"
  alarm_description   = "Latencia p99 de la API"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "TargetResponseTime"
  extended_statistic  = "p99"
  period              = 300
  evaluation_periods  = 2
  comparison_operator = "GreaterThanThreshold"
  threshold           = var.api_latency_p99_seconds
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
    TargetGroup  = var.target_group_arn_suffixes["api"]
  }
}

# --- ECS: CPU y memoria por servicio ---

resource "aws_cloudwatch_metric_alarm" "service_utilization" {
  for_each = {
    for pair in setproduct(keys(var.service_names), ["CPUUtilization", "MemoryUtilization"]) :
    "${pair[0]}-${pair[1]}" => { service = pair[0], metric = pair[1] }
  }

  alarm_name          = "${var.name_prefix}-${each.key}"
  alarm_description   = "${each.value.metric} alto en el servicio ${each.value.service}"
  namespace           = "AWS/ECS"
  metric_name         = each.value.metric
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  comparison_operator = "GreaterThanThreshold"
  threshold           = 85
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]

  dimensions = {
    ClusterName = var.cluster_name
    ServiceName = var.service_names[each.value.service]
  }
}

# --- RDS ---

resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "${var.name_prefix}-rds-cpu"
  alarm_description   = "CPU alta en RDS"
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  comparison_operator = "GreaterThanThreshold"
  threshold           = 80
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]

  dimensions = {
    DBInstanceIdentifier = var.db_instance_identifier
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_storage" {
  alarm_name          = "${var.name_prefix}-rds-free-storage"
  alarm_description   = "Poco almacenamiento libre en RDS"
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  statistic           = "Minimum"
  period              = 300
  evaluation_periods  = 1
  comparison_operator = "LessThanThreshold"
  threshold           = var.rds_min_free_storage_bytes
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]

  dimensions = {
    DBInstanceIdentifier = var.db_instance_identifier
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_connections" {
  alarm_name          = "${var.name_prefix}-rds-connections"
  alarm_description   = "Conexiones a RDS cerca del límite (pregunta 1 de docs/aws-deploy.md)"
  namespace           = "AWS/RDS"
  metric_name         = "DatabaseConnections"
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 2
  comparison_operator = "GreaterThanThreshold"
  threshold           = var.rds_max_connections_alarm
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]

  dimensions = {
    DBInstanceIdentifier = var.db_instance_identifier
  }
}

# El multiplexado de RDS Proxy se pierde con estado de sesión (SET); se vigila el anclaje.
resource "aws_cloudwatch_metric_alarm" "proxy_pinning" {
  alarm_name          = "${var.name_prefix}-rds-proxy-pinning"
  alarm_description   = "Conexiones ancladas en RDS Proxy: alguna transacción usa estado de sesión"
  namespace           = "AWS/RDS"
  metric_name         = "DatabaseConnectionsCurrentlySessionPinned"
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 2
  comparison_operator = "GreaterThanThreshold"
  threshold           = 0
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]

  dimensions = {
    ProxyName = var.db_proxy_name
  }
}

# --- SES: reputación de la cuenta (SES pausa el envío con tasas altas) ---

resource "aws_cloudwatch_metric_alarm" "ses_reputation" {
  for_each = {
    "Reputation.BounceRate"    = 0.05
    "Reputation.ComplaintRate" = 0.001
  }

  alarm_name          = "${var.name_prefix}-ses-${lower(replace(each.key, ".", "-"))}"
  alarm_description   = "${each.key} de SES por encima del umbral"
  namespace           = "AWS/SES"
  metric_name         = each.key
  statistic           = "Maximum"
  period              = 3600
  evaluation_periods  = 1
  comparison_operator = "GreaterThanThreshold"
  threshold           = each.value
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]
}
