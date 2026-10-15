# TreoWallet en AWS: la propuesta de docs/aws-deploy.md como código. Un mismo módulo raíz para dev,
# staging y prod; cada ambiente vive en su cuenta, con su backend y su archivo de variables.

locals {
  name_prefix  = "treo-${var.environment}"
  web_hostname = "${var.web_subdomain}.${var.domain_name}"
  api_hostname = "${var.api_subdomain}.${var.domain_name}"

  api_port = 4000
  web_port = 3000

  # dev se puede destruir y recrear; staging y prod no.
  deletion_protection = var.db_deletion_protection
}

data "aws_route53_zone" "public" {
  name         = var.domain_name
  private_zone = false
}

module "kms" {
  source = "../modules/kms"

  name_prefix = local.name_prefix
}

module "network" {
  source = "../modules/network"

  name_prefix                = local.name_prefix
  cidr_block                 = var.vpc_cidr
  az_count                   = var.az_count
  single_nat_gateway         = var.single_nat_gateway
  enable_interface_endpoints = var.enable_interface_endpoints
  logs_kms_key_arn           = module.kms.logs_key_arn
  log_retention_days         = var.log_retention_days
}

module "security_groups" {
  source = "../modules/security-groups"

  name_prefix = local.name_prefix
  vpc_id      = module.network.vpc_id
  api_port    = local.api_port
  web_port    = local.web_port
}

module "certificates" {
  source = "../modules/certificates"
  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  zone_id      = data.aws_route53_zone.public.zone_id
  web_hostname = local.web_hostname
  api_hostname = local.api_hostname
}

module "load_balancer" {
  source = "../modules/load-balancer"

  name_prefix               = local.name_prefix
  vpc_id                    = module.network.vpc_id
  subnet_ids                = module.network.private_subnet_ids
  security_group_id         = module.security_groups.alb_id
  certificate_arn           = module.certificates.regional_certificate_arn
  web_hostname              = local.web_hostname
  api_hostname              = local.api_hostname
  api_port                  = local.api_port
  web_port                  = local.web_port
  deletion_protection       = local.deletion_protection
  access_log_retention_days = var.log_retention_days
}

module "edge" {
  source = "../modules/edge"
  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  name_prefix        = local.name_prefix
  zone_id            = data.aws_route53_zone.public.zone_id
  web_hostname       = local.web_hostname
  api_hostname       = local.api_hostname
  certificate_arn    = module.certificates.global_certificate_arn
  alb_arn            = module.load_balancer.arn
  alb_dns_name       = module.load_balancer.dns_name
  log_retention_days = var.log_retention_days
}

module "audit" {
  source = "../modules/audit"

  name_prefix      = local.name_prefix
  kms_key_arn      = module.kms.audit_key_arn
  object_lock_mode = var.audit_object_lock_mode
  retention_days   = var.audit_retention_days
}

module "database" {
  source = "../modules/database"
  providers = {
    aws    = aws
    aws.dr = aws.dr
  }

  name_prefix                 = local.name_prefix
  region                      = var.region
  subnet_ids                  = module.network.database_subnet_ids
  security_group_id           = module.security_groups.database_id
  proxy_security_group_id     = module.security_groups.rds_proxy_id
  kms_key_arn                 = module.kms.data_key_arn
  instance_class              = var.db_instance_class
  multi_az                    = var.db_multi_az
  backup_retention_days       = var.db_backup_retention_days
  deletion_protection         = local.deletion_protection
  credentials_version         = var.db_credentials_version
  secret_recovery_window_days = var.secret_recovery_window_days
  audit_bucket_arn            = module.audit.bucket_arn
  audit_kms_key_arn           = module.kms.audit_key_arn
  enable_cross_region_backups = var.enable_cross_region_backups
}

module "cache" {
  source = "../modules/cache"

  name_prefix                 = local.name_prefix
  subnet_ids                  = module.network.database_subnet_ids
  security_group_id           = module.security_groups.cache_id
  kms_key_arn                 = module.kms.data_key_arn
  logs_kms_key_arn            = module.kms.logs_key_arn
  node_type                   = var.cache_node_type
  num_cache_clusters          = var.cache_num_nodes
  auth_token_version          = var.cache_auth_token_version
  secret_recovery_window_days = var.secret_recovery_window_days
  log_retention_days          = var.log_retention_days
}

module "application_secrets" {
  source = "../modules/application-secrets"

  name_prefix                 = local.name_prefix
  kms_key_arn                 = module.kms.data_key_arn
  secrets_version             = var.signing_secrets_version
  secret_recovery_window_days = var.secret_recovery_window_days
}

module "email" {
  source = "../modules/email"

  name_prefix                 = local.name_prefix
  zone_id                     = data.aws_route53_zone.public.zone_id
  domain_name                 = var.domain_name
  dmarc_report_address        = var.dmarc_report_address
  kms_key_arn                 = module.kms.data_key_arn
  secret_recovery_window_days = var.secret_recovery_window_days
}

module "container_registry" {
  source = "../modules/container-registry"

  name_prefix = local.name_prefix
  kms_key_arn = module.kms.data_key_arn
}

module "compute" {
  source = "../modules/compute"

  name_prefix = local.name_prefix
  region      = var.region
  subnet_ids  = module.network.private_subnet_ids

  api_security_group_id       = module.security_groups.api_id
  web_security_group_id       = module.security_groups.web_id
  api_target_group_arn        = module.load_balancer.api_target_group_arn
  web_target_group_arn        = module.load_balancer.web_target_group_arn
  alb_arn_suffix              = module.load_balancer.arn_suffix
  api_target_group_arn_suffix = module.load_balancer.api_target_group_arn_suffix

  repository_urls      = module.container_registry.repository_urls
  api_image_tag        = var.api_image_tag
  migrations_image_tag = var.migrations_image_tag
  web_image_tag        = var.web_image_tag
  cpu_architecture     = var.cpu_architecture
  use_fargate_spot     = var.use_fargate_spot

  api_port      = local.api_port
  web_port      = local.web_port
  api_cpu       = var.api_cpu
  api_memory    = var.api_memory
  api_min_count = var.api_min_count
  api_max_count = var.api_max_count
  web_cpu       = var.web_cpu
  web_memory    = var.web_memory
  web_min_count = var.web_min_count
  web_max_count = var.web_max_count

  clabe_bank_code       = var.clabe_bank_code
  clabe_plaza_code      = var.clabe_plaza_code
  smtp_host             = module.email.smtp_host
  smtp_from             = "${var.mail_from_name} <no-reply@${var.domain_name}>"
  trusted_proxy_cidrs   = module.network.private_subnet_cidrs
  api_extra_environment = var.api_extra_environment

  api_base_url        = "https://${local.api_hostname}"
  web_allowed_origins = ["https://${local.web_hostname}"]

  secrets = {
    database_master   = module.database.master_secret_arn
    database_migrator = module.database.migrator_secret_arn
    database_app      = module.database.app_secret_arn
    signing           = module.application_secrets.secret_arn
    smtp              = module.email.smtp_secret_arn
    cache             = module.cache.secret_arn
  }

  data_kms_key_arn   = module.kms.data_key_arn
  logs_kms_key_arn   = module.kms.logs_key_arn
  log_retention_days = var.log_retention_days
}

module "monitoring" {
  source = "../modules/monitoring"

  name_prefix        = local.name_prefix
  kms_key_arn        = module.kms.data_key_arn
  alarm_emails       = var.alarm_emails
  api_log_group_name = module.compute.log_group_names["api"]
  alb_arn_suffix     = module.load_balancer.arn_suffix
  target_group_arn_suffixes = {
    api = module.load_balancer.api_target_group_arn_suffix
    web = module.load_balancer.web_target_group_arn_suffix
  }
  cluster_name           = module.compute.cluster_name
  service_names          = module.compute.service_names
  db_instance_identifier = module.database.instance_identifier
  db_proxy_name          = module.database.proxy_name
}
