# Cómputo en ECS Fargate (docs/aws-deploy.md, secciones 1 y 3). Cuatro definiciones de tarea:
#   - api:        servicio de larga vida detrás del ALB (rol de base wallet_app, por RDS Proxy).
#   - web:        servicio de larga vida del BFF de Next.js detrás del ALB.
#   - migrations: tarea puntual con la imagen de la API (`db:migrate`, rol wallet_migrator).
#   - bootstrap:  tarea puntual con la imagen de la API (`db:bootstrap`, superusuario de RDS).
#
# Cada definición tiene su propio rol de ejecución y ese rol solo lee los secretos que su tarea
# recibe: la API nunca puede leer las credenciales de wallet_migrator ni las del superusuario.

data "aws_partition" "current" {}

locals {
  partition = data.aws_partition.current.partition

  secret_ref = {
    database_url          = "${var.secrets.database_app}:url::"
    migration_url         = "${var.secrets.database_migrator}:url::"
    bootstrap_url         = "${var.secrets.database_master}:url::"
    migrator_password     = "${var.secrets.database_migrator}:password::"
    app_password          = "${var.secrets.database_app}:password::"
    jwt_secret            = "${var.secrets.signing}:jwt_secret::"
    otp_hmac_secret       = "${var.secrets.signing}:otp_hmac_secret::"
    cursor_signing_secret = "${var.secrets.signing}:cursor_signing_secret::"
    smtp_user             = "${var.secrets.smtp}:user::"
    smtp_password         = "${var.secrets.smtp}:password::"
    redis_url             = "${var.secrets.cache}:url::"
  }

  api_image = "${var.repository_urls["api"]}:${var.api_image_tag}"
  # Las tareas de la base pueden ir una versión adelante del servicio (se corren antes de actualizarlo).
  migrations_image = "${var.repository_urls["api"]}:${coalesce(var.migrations_image_tag, var.api_image_tag)}"
  web_image        = "${var.repository_urls["web"]}:${var.web_image_tag}"

  tasks = {
    api = {
      image          = local.api_image
      command        = null
      port           = var.api_port
      cpu            = var.api_cpu
      memory         = var.api_memory
      read_only_root = true
      environment = merge({
        NODE_ENV          = "production"
        HOST              = "0.0.0.0"
        PORT              = tostring(var.api_port)
        LOG_LEVEL         = var.api_log_level
        JWT_ISSUER        = "wallet-api"
        JWT_AUDIENCE      = "wallet-clients"
        CLABE_BANK_CODE   = var.clabe_bank_code
        CLABE_PLAZA_CODE  = var.clabe_plaza_code
        SMTP_HOST         = var.smtp_host
        SMTP_PORT         = "587"
        SMTP_FROM         = var.smtp_from
        TRUSTED_PROXIES   = join(",", var.trusted_proxy_cidrs)
        SCHEDULER_ENABLED = "true"
      }, var.api_extra_environment)
      secrets = {
        DATABASE_URL          = local.secret_ref.database_url
        JWT_SECRET            = local.secret_ref.jwt_secret
        OTP_HMAC_SECRET       = local.secret_ref.otp_hmac_secret
        CURSOR_SIGNING_SECRET = local.secret_ref.cursor_signing_secret
        SMTP_USER             = local.secret_ref.smtp_user
        SMTP_PASSWORD         = local.secret_ref.smtp_password
        REDIS_URL             = local.secret_ref.redis_url
      }
      secret_arns = [var.secrets.database_app, var.secrets.signing, var.secrets.smtp, var.secrets.cache]
    }

    web = {
      image   = local.web_image
      command = null
      port    = var.web_port
      cpu     = var.web_cpu
      memory  = var.web_memory
      # `next start` escribe la caché de imágenes y de rutas en .next/cache.
      read_only_root = false
      environment = merge({
        NODE_ENV              = "production"
        PORT                  = tostring(var.web_port)
        HOSTNAME              = "0.0.0.0"
        API_BASE_URL          = var.api_base_url
        ALLOWED_ORIGINS       = join(",", var.web_allowed_origins)
        SESSION_COOKIE_SECURE = "true"
        SESSION_IDLE_MINUTES  = "15"
      }, var.web_extra_environment)
      secrets = {
        REDIS_URL = local.secret_ref.redis_url
      }
      secret_arns = [var.secrets.cache]
    }

    migrations = {
      image          = local.migrations_image
      command        = var.migrations_command
      port           = null
      cpu            = 512
      memory         = 1024
      read_only_root = true
      environment    = { NODE_ENV = "production" }
      secrets = {
        MIGRATION_DATABASE_URL = local.secret_ref.migration_url
      }
      secret_arns = [var.secrets.database_migrator]
    }

    bootstrap = {
      image          = local.migrations_image
      command        = var.bootstrap_command
      port           = null
      cpu            = 256
      memory         = 512
      read_only_root = true
      environment    = { NODE_ENV = "production" }
      secrets = {
        BOOTSTRAP_DATABASE_URL   = local.secret_ref.bootstrap_url
        WALLET_MIGRATOR_PASSWORD = local.secret_ref.migrator_password
        WALLET_APP_PASSWORD      = local.secret_ref.app_password
      }
      secret_arns = [var.secrets.database_master, var.secrets.database_migrator, var.secrets.database_app]
    }
  }

  services = {
    api = {
      target_group_arn = var.api_target_group_arn
      security_group   = var.api_security_group_id
      desired_count    = var.api_min_count
      min_count        = var.api_min_count
      max_count        = var.api_max_count
    }
    web = {
      target_group_arn = var.web_target_group_arn
      security_group   = var.web_security_group_id
      desired_count    = var.web_min_count
      min_count        = var.web_min_count
      max_count        = var.web_max_count
    }
  }
}

# --- Cluster ---

resource "aws_ecs_cluster" "this" {
  name = var.name_prefix

  setting {
    name  = "containerInsights"
    value = "enhanced"
  }
}

resource "aws_ecs_cluster_capacity_providers" "this" {
  cluster_name       = aws_ecs_cluster.this.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = var.use_fargate_spot ? "FARGATE_SPOT" : "FARGATE"
    weight            = 1
  }
}

# --- Logs (driver awslogs hacia CloudWatch; la API ya escribe JSON con pino) ---

resource "aws_cloudwatch_log_group" "this" {
  for_each = local.tasks

  name              = "/treo/${var.name_prefix}/${each.key}"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.logs_kms_key_arn
}

# --- Roles de ejecución: descargar la imagen, escribir logs y leer solo sus secretos ---

data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  for_each = local.tasks

  name               = "${var.name_prefix}-${each.key}-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

resource "aws_iam_role_policy_attachment" "execution" {
  for_each = local.tasks

  role       = aws_iam_role.execution[each.key].name
  policy_arn = "arn:${local.partition}:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "execution_secrets" {
  for_each = local.tasks

  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = each.value.secret_arns
  }

  statement {
    actions   = ["kms:Decrypt"]
    resources = [var.data_kms_key_arn]
    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["secretsmanager.${var.region}.amazonaws.com", "ecr.${var.region}.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "execution_secrets" {
  for_each = local.tasks

  name   = "read-own-secrets"
  role   = aws_iam_role.execution[each.key].id
  policy = data.aws_iam_policy_document.execution_secrets[each.key].json
}

# --- Definiciones de tarea ---

resource "aws_ecs_task_definition" "this" {
  for_each = local.tasks

  family                   = "${var.name_prefix}-${each.key}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = each.value.cpu
  memory                   = each.value.memory
  execution_role_arn       = aws_iam_role.execution[each.key].arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = var.cpu_architecture
  }

  # Con el sistema de archivos raíz de solo lectura, /tmp es el único lugar escribible.
  dynamic "volume" {
    for_each = each.value.read_only_root ? ["tmp"] : []
    content {
      name = volume.value
    }
  }

  container_definitions = jsonencode([
    merge(
      {
        name                   = each.key
        image                  = each.value.image
        essential              = true
        readonlyRootFilesystem = each.value.read_only_root
        environment            = [for name, value in each.value.environment : { name = name, value = value }]
        secrets                = [for name, ref in each.value.secrets : { name = name, valueFrom = ref }]
        mountPoints            = each.value.read_only_root ? [{ sourceVolume = "tmp", containerPath = "/tmp", readOnly = false }] : []
        portMappings           = each.value.port == null ? [] : [{ containerPort = each.value.port, protocol = "tcp" }]
        linuxParameters        = { initProcessEnabled = true }
        stopTimeout            = 30
        logConfiguration = {
          logDriver = "awslogs"
          options = {
            awslogs-group         = aws_cloudwatch_log_group.this[each.key].name
            awslogs-region        = var.region
            awslogs-stream-prefix = each.key
            mode                  = "non-blocking"
            max-buffer-size       = "25m"
          }
        }
      },
      each.value.command == null ? {} : { command = each.value.command },
    )
  ])

  depends_on = [aws_iam_role_policy.execution_secrets]
}

# --- Servicios ---

resource "aws_ecs_service" "this" {
  for_each = local.services

  name                   = each.key
  cluster                = aws_ecs_cluster.this.id
  task_definition        = aws_ecs_task_definition.this[each.key].arn
  desired_count          = each.value.desired_count
  platform_version       = "LATEST"
  enable_execute_command = false
  propagate_tags         = "SERVICE"

  enable_ecs_managed_tags           = true
  health_check_grace_period_seconds = 30
  availability_zone_rebalancing     = "ENABLED"

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  capacity_provider_strategy {
    capacity_provider = var.use_fargate_spot ? "FARGATE_SPOT" : "FARGATE"
    weight            = 1
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = [each.value.security_group]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = each.value.target_group_arn
    container_name   = each.key
    container_port   = local.tasks[each.key].port
  }

  wait_for_steady_state = var.wait_for_steady_state

  # El autoescalado mueve desired_count; Terraform no lo regresa al mínimo en cada apply.
  lifecycle {
    ignore_changes = [desired_count]
  }

  depends_on = [aws_ecs_cluster_capacity_providers.this]
}

# --- Autoescalado ---

resource "aws_appautoscaling_target" "this" {
  for_each = local.services

  service_namespace  = "ecs"
  resource_id        = "service/${aws_ecs_cluster.this.name}/${aws_ecs_service.this[each.key].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  min_capacity       = each.value.min_count
  max_capacity       = each.value.max_count
}

resource "aws_appautoscaling_policy" "cpu" {
  for_each = local.services

  name               = "${var.name_prefix}-${each.key}-cpu"
  policy_type        = "TargetTrackingScaling"
  service_namespace  = aws_appautoscaling_target.this[each.key].service_namespace
  resource_id        = aws_appautoscaling_target.this[each.key].resource_id
  scalable_dimension = aws_appautoscaling_target.this[each.key].scalable_dimension

  target_tracking_scaling_policy_configuration {
    target_value       = var.cpu_target_percent
    scale_in_cooldown  = 300
    scale_out_cooldown = 60

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}

resource "aws_appautoscaling_policy" "api_requests" {
  name               = "${var.name_prefix}-api-requests"
  policy_type        = "TargetTrackingScaling"
  service_namespace  = aws_appautoscaling_target.this["api"].service_namespace
  resource_id        = aws_appautoscaling_target.this["api"].resource_id
  scalable_dimension = aws_appautoscaling_target.this["api"].scalable_dimension

  target_tracking_scaling_policy_configuration {
    target_value       = var.api_requests_per_target
    scale_in_cooldown  = 300
    scale_out_cooldown = 60

    predefined_metric_specification {
      predefined_metric_type = "ALBRequestCountPerTarget"
      resource_label         = "${var.alb_arn_suffix}/${var.api_target_group_arn_suffix}"
    }
  }
}
