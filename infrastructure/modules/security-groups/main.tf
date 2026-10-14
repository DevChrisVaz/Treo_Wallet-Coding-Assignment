# Todos los grupos de seguridad en un solo lugar, para que la postura de red se revise completa:
#
#   CloudFront (VPC origin) ──443──▶ ALB ──4000──▶ API ──5432──▶ RDS Proxy ──5432──▶ RDS
#                                     │                 └─6379─▶ ElastiCache
#                                     └──3000──▶ BFF ──443──▶ ALB (api.dominio, red interna)
#                                                    └─6379─▶ ElastiCache
#   Migraciones ──5432──▶ RDS (directo, rol wallet_migrator)
#
# La salida a 443 de las tareas cubre las APIs de AWS (por los endpoints o el NAT) y la llamada
# del BFF a la API a través del ALB; la de 587 es el SMTP de SES.

data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

locals {
  groups = {
    alb        = "ALB interno: solo CloudFront y el BFF"
    api        = "Tareas de la API"
    web        = "Tareas del BFF de Next.js"
    migrations = "Tareas puntuales de migraciones y bootstrap de la base"
    rds_proxy  = "RDS Proxy de la API"
    database   = "RDS for PostgreSQL"
    cache      = "ElastiCache: sesiones y rate limiting"
  }
}

resource "aws_security_group" "this" {
  for_each = local.groups

  name        = "${var.name_prefix}-${replace(each.key, "_", "-")}"
  description = each.value
  vpc_id      = var.vpc_id

  tags = { Name = "${var.name_prefix}-${replace(each.key, "_", "-")}" }

  lifecycle {
    create_before_destroy = true
  }
}

locals {
  sg = { for key, group in aws_security_group.this : key => group.id }

  # Reglas entre grupos: origen → destino por puerto.
  group_rules = {
    alb_from_web       = { to = "alb", from = "web", port = 443, description = "BFF hacia la API por el ALB" }
    api_from_alb       = { to = "api", from = "alb", port = var.api_port, description = "ALB hacia la API" }
    web_from_alb       = { to = "web", from = "alb", port = var.web_port, description = "ALB hacia el BFF" }
    proxy_from_api     = { to = "rds_proxy", from = "api", port = 5432, description = "API hacia RDS Proxy" }
    db_from_proxy      = { to = "database", from = "rds_proxy", port = 5432, description = "RDS Proxy hacia RDS" }
    db_from_migrations = { to = "database", from = "migrations", port = 5432, description = "Migraciones directo a RDS" }
    cache_from_api     = { to = "cache", from = "api", port = 6379, description = "API hacia ElastiCache" }
    cache_from_web     = { to = "cache", from = "web", port = 6379, description = "BFF hacia ElastiCache" }
  }

  # Salida a internet (o a los endpoints de la VPC) por puerto.
  internet_egress = {
    api_https        = { group = "api", port = 443, description = "APIs de AWS" }
    api_smtp         = { group = "api", port = 587, description = "SMTP de Amazon SES con STARTTLS" }
    web_https        = { group = "web", port = 443, description = "API por el ALB y APIs de AWS" }
    migrations_https = { group = "migrations", port = 443, description = "APIs de AWS" }
  }
}

resource "aws_vpc_security_group_ingress_rule" "alb_from_cloudfront" {
  security_group_id = local.sg["alb"]
  description       = "CloudFront hacia el ALB (lista de prefijos administrada)"
  prefix_list_id    = data.aws_ec2_managed_prefix_list.cloudfront.id
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
}

resource "aws_vpc_security_group_ingress_rule" "group" {
  for_each = local.group_rules

  security_group_id            = local.sg[each.value.to]
  referenced_security_group_id = local.sg[each.value.from]
  description                  = each.value.description
  ip_protocol                  = "tcp"
  from_port                    = each.value.port
  to_port                      = each.value.port
}

resource "aws_vpc_security_group_egress_rule" "group" {
  for_each = local.group_rules

  security_group_id            = local.sg[each.value.from]
  referenced_security_group_id = local.sg[each.value.to]
  description                  = each.value.description
  ip_protocol                  = "tcp"
  from_port                    = each.value.port
  to_port                      = each.value.port
}

resource "aws_vpc_security_group_egress_rule" "internet" {
  for_each = local.internet_egress

  security_group_id = local.sg[each.value.group]
  description       = each.value.description
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = each.value.port
  to_port           = each.value.port
}
