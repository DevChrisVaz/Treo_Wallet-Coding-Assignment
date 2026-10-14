# ALB interno con ruteo por host (docs/aws-deploy.md, secciones 1 y 3): web.dominio va al BFF y
# api.dominio a la API. No tiene IP pública: CloudFront entra por un VPC origin y el BFF llega por
# la red interna, resolviendo api.dominio en la zona privada de Route 53.

data "aws_elb_service_account" "current" {}
data "aws_caller_identity" "current" {}

# --- Logs de acceso. El ALB solo escribe en buckets con SSE-S3, no con llaves de KMS del cliente ---

resource "aws_s3_bucket" "access_logs" {
  bucket        = "${var.name_prefix}-alb-logs-${data.aws_caller_identity.current.account_id}"
  force_destroy = false
}

resource "aws_s3_bucket_public_access_block" "access_logs" {
  bucket = aws_s3_bucket.access_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "access_logs" {
  bucket = aws_s3_bucket.access_logs.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "access_logs" {
  bucket = aws_s3_bucket.access_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "access_logs" {
  bucket = aws_s3_bucket.access_logs.id

  rule {
    id     = "expirar"
    status = "Enabled"
    filter {}
    expiration {
      days = var.access_log_retention_days
    }
  }
}

# Dos formas de autorizar al ALB: la cuenta de ELB de la región (regiones anteriores a agosto de
# 2022, como us-east-1) y el principal de servicio (regiones posteriores). En una región nueva,
# aws_elb_service_account no existe y la primera declaración se quita.
data "aws_iam_policy_document" "access_logs" {
  statement {
    sid       = "ElbAccountWriteAccessLogs"
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.access_logs.arn}/alb/AWSLogs/${data.aws_caller_identity.current.account_id}/*"]
    principals {
      type        = "AWS"
      identifiers = [data.aws_elb_service_account.current.arn]
    }
  }

  statement {
    sid       = "ElbServiceWriteAccessLogs"
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.access_logs.arn}/alb/AWSLogs/${data.aws_caller_identity.current.account_id}/*"]
    principals {
      type        = "Service"
      identifiers = ["logdelivery.elasticloadbalancing.amazonaws.com"]
    }
  }

  statement {
    sid       = "DenyInsecureTransport"
    effect    = "Deny"
    actions   = ["s3:*"]
    resources = [aws_s3_bucket.access_logs.arn, "${aws_s3_bucket.access_logs.arn}/*"]
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

resource "aws_s3_bucket_policy" "access_logs" {
  bucket = aws_s3_bucket.access_logs.id
  policy = data.aws_iam_policy_document.access_logs.json

  depends_on = [aws_s3_bucket_public_access_block.access_logs]
}

# --- Balanceador ---

resource "aws_lb" "this" {
  name                       = var.name_prefix
  load_balancer_type         = "application"
  internal                   = true
  subnets                    = var.subnet_ids
  security_groups            = [var.security_group_id]
  drop_invalid_header_fields = true
  enable_deletion_protection = var.deletion_protection
  # El más largo de la cadena de timeouts (pregunta 1 de docs/aws-deploy.md): pool, lock y
  # statement fallan antes y devuelven un error reintentable.
  idle_timeout = var.idle_timeout_seconds

  access_logs {
    bucket  = aws_s3_bucket.access_logs.id
    prefix  = "alb"
    enabled = true
  }

  depends_on = [aws_s3_bucket_policy.access_logs]
}

resource "aws_lb_target_group" "api" {
  name                 = "${var.name_prefix}-api"
  port                 = var.api_port
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = var.vpc_id
  deregistration_delay = 30

  # GET /health (PLT-10) no toca la base: una falla momentánea de PostgreSQL no saca de servicio
  # a todas las tareas.
  health_check {
    path                = "/health"
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_target_group" "web" {
  name                 = "${var.name_prefix}-web"
  port                 = var.web_port
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = var.vpc_id
  deregistration_delay = 30

  health_check {
    path                = "/login"
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  # Provisional: la sesión del BFF vive en un Map en memoria de cada tarea. Mientras no se use
  # ElastiCache como SessionStore, la cookie de afinidad mantiene a cada navegador en su tarea.
  stickiness {
    type            = "lb_cookie"
    enabled         = var.web_sticky_sessions
    cookie_duration = 3600
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      message_body = "Not Found"
      status_code  = "404"
    }
  }
}

resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 10

  condition {
    host_header {
      values = [var.api_hostname]
    }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

resource "aws_lb_listener_rule" "web" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 20

  condition {
    host_header {
      values = [var.web_hostname]
    }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }
}

# --- Zona privada: dentro de la VPC, api.dominio resuelve al ALB interno y no a CloudFront ---

resource "aws_route53_zone" "private_api" {
  name    = var.api_hostname
  comment = "Resolución interna de la API para el BFF (${var.name_prefix})"

  vpc {
    vpc_id = var.vpc_id
  }
}

resource "aws_route53_record" "private_api" {
  zone_id = aws_route53_zone.private_api.zone_id
  name    = var.api_hostname
  type    = "A"

  alias {
    name                   = aws_lb.this.dns_name
    zone_id                = aws_lb.this.zone_id
    evaluate_target_health = true
  }
}
