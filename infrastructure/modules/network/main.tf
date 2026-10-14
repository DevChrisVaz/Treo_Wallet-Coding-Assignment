# VPC en dos o más zonas de disponibilidad (docs/aws-deploy.md, diagrama). Tres capas de subredes:
#   - públicas:  solo los NAT Gateway (el ALB es interno; CloudFront entra por un VPC origin).
#   - privadas:  ECS (API, BFF y tareas puntuales), el ALB interno y las interfaces de los endpoints.
#   - de datos:  RDS, RDS Proxy y ElastiCache, sin ruta a internet.

# Los nombres de zona (us-east-1a) cambian por cuenta; los IDs (use1-az3) no. Se excluyen por ID
# las zonas donde CloudFront no admite VPC origins, porque el ALB vive en estas subredes.
data "aws_availability_zones" "available" {
  state            = "available"
  exclude_zone_ids = var.excluded_zone_ids
}

data "aws_region" "current" {}

locals {
  azs = slice(data.aws_availability_zones.available.names, 0, var.az_count)

  # /24 públicas al inicio del rango, /20 privadas (caben muchas tareas de Fargate) y /24 de datos al final.
  public_cidrs   = [for i in range(var.az_count) : cidrsubnet(var.cidr_block, 8, i)]
  private_cidrs  = [for i in range(var.az_count) : cidrsubnet(var.cidr_block, 4, i + 1)]
  database_cidrs = [for i in range(var.az_count) : cidrsubnet(var.cidr_block, 8, 200 + i)]

  nat_count = var.single_nat_gateway ? 1 : var.az_count
}

resource "aws_vpc" "this" {
  cidr_block           = var.cidr_block
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = var.name_prefix }
}

# El grupo de seguridad por defecto queda sin reglas: todo recurso declara el suyo.
resource "aws_default_security_group" "this" {
  vpc_id = aws_vpc.this.id

  tags = { Name = "${var.name_prefix}-default-sin-reglas" }
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = { Name = var.name_prefix }
}

resource "aws_subnet" "public" {
  count = var.az_count

  vpc_id            = aws_vpc.this.id
  cidr_block        = local.public_cidrs[count.index]
  availability_zone = local.azs[count.index]

  tags = { Name = "${var.name_prefix}-public-${local.azs[count.index]}", Tier = "public" }
}

resource "aws_subnet" "private" {
  count = var.az_count

  vpc_id            = aws_vpc.this.id
  cidr_block        = local.private_cidrs[count.index]
  availability_zone = local.azs[count.index]

  tags = { Name = "${var.name_prefix}-private-${local.azs[count.index]}", Tier = "private" }
}

resource "aws_subnet" "database" {
  count = var.az_count

  vpc_id            = aws_vpc.this.id
  cidr_block        = local.database_cidrs[count.index]
  availability_zone = local.azs[count.index]

  tags = { Name = "${var.name_prefix}-database-${local.azs[count.index]}", Tier = "database" }
}

resource "aws_eip" "nat" {
  count = local.nat_count

  domain = "vpc"

  tags = { Name = "${var.name_prefix}-nat-${local.azs[count.index]}" }
}

resource "aws_nat_gateway" "this" {
  count = local.nat_count

  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = { Name = "${var.name_prefix}-${local.azs[count.index]}" }

  depends_on = [aws_internet_gateway.this]
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }

  tags = { Name = "${var.name_prefix}-public" }
}

resource "aws_route_table_association" "public" {
  count = var.az_count

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Una tabla por zona: si una zona pierde su NAT Gateway, las otras siguen saliendo por el suyo.
resource "aws_route_table" "private" {
  count = var.az_count

  vpc_id = aws_vpc.this.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.this[var.single_nat_gateway ? 0 : count.index].id
  }

  tags = { Name = "${var.name_prefix}-private-${local.azs[count.index]}" }
}

resource "aws_route_table_association" "private" {
  count = var.az_count

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# Sin ruta por defecto: la base y la caché no salen a internet ni se alcanzan desde él.
resource "aws_route_table" "database" {
  vpc_id = aws_vpc.this.id

  tags = { Name = "${var.name_prefix}-database" }
}

resource "aws_route_table_association" "database" {
  count = var.az_count

  subnet_id      = aws_subnet.database[count.index].id
  route_table_id = aws_route_table.database.id
}

# --- Endpoints: el tráfico a S3 y a las APIs de AWS no pasa por el NAT ---

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.${data.aws_region.current.region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = aws_route_table.private[*].id

  tags = { Name = "${var.name_prefix}-s3" }
}

resource "aws_security_group" "endpoints" {
  count = var.enable_interface_endpoints ? 1 : 0

  name        = "${var.name_prefix}-vpc-endpoints"
  description = "HTTPS desde la VPC hacia los endpoints de interfaz"
  vpc_id      = aws_vpc.this.id

  tags = { Name = "${var.name_prefix}-vpc-endpoints" }
}

resource "aws_vpc_security_group_ingress_rule" "endpoints_https" {
  count = var.enable_interface_endpoints ? 1 : 0

  security_group_id = aws_security_group.endpoints[0].id
  description       = "HTTPS desde la VPC"
  cidr_ipv4         = var.cidr_block
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
}

resource "aws_vpc_endpoint" "interface" {
  for_each = var.enable_interface_endpoints ? toset(var.interface_endpoint_services) : toset([])

  vpc_id              = aws_vpc.this.id
  service_name        = "com.amazonaws.${data.aws_region.current.region}.${each.value}"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.endpoints[0].id]
  private_dns_enabled = true

  tags = { Name = "${var.name_prefix}-${each.value}" }
}

# --- Flow logs: registro de todo el tráfico aceptado y rechazado de la VPC ---

resource "aws_cloudwatch_log_group" "flow_logs" {
  name              = "/treo/${var.name_prefix}/vpc-flow-logs"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.logs_kms_key_arn
}

data "aws_iam_policy_document" "flow_logs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["vpc-flow-logs.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "flow_logs" {
  statement {
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams"]
    resources = ["${aws_cloudwatch_log_group.flow_logs.arn}:*"]
  }
}

resource "aws_iam_role" "flow_logs" {
  name               = "${var.name_prefix}-vpc-flow-logs"
  assume_role_policy = data.aws_iam_policy_document.flow_logs_assume.json
}

resource "aws_iam_role_policy" "flow_logs" {
  name   = "write-flow-logs"
  role   = aws_iam_role.flow_logs.id
  policy = data.aws_iam_policy_document.flow_logs.json
}

resource "aws_flow_log" "this" {
  vpc_id          = aws_vpc.this.id
  traffic_type    = "ALL"
  log_destination = aws_cloudwatch_log_group.flow_logs.arn
  iam_role_arn    = aws_iam_role.flow_logs.arn
}
