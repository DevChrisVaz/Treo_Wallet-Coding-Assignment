# Evalúa el stack completo con proveedores simulados (sin credenciales ni costo). Se corre una vez
# por ambiente con su archivo de variables:
#
#   terraform test -var-file=../environments/dev.tfvars
#
# Simula un apply: resuelve cada módulo, cada for_each y cada referencia entre módulos con valores
# inventados, así que detecta errores que `terraform validate` no ve (tipos, índices, ciclos).

# El proveedor valida el formato de los ARN y de las políticas aun con datos simulados: los
# valores por defecto de abajo solo cumplen ese formato.
mock_provider "aws" {
  mock_data "aws_partition" {
    defaults = { partition = "aws" }
  }
  mock_data "aws_region" {
    defaults = { region = "us-east-1" }
  }
  mock_data "aws_caller_identity" {
    defaults = { account_id = "000000000000" }
  }
  mock_data "aws_availability_zones" {
    defaults = { names = ["us-east-1a", "us-east-1b", "us-east-1c"] }
  }
  mock_data "aws_iam_policy_document" {
    defaults = { json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}" }
  }
  mock_data "aws_elb_service_account" {
    defaults = { arn = "arn:aws:iam::127311923021:root" }
  }

  mock_resource "aws_kms_key" {
    defaults = { arn = "arn:aws:kms:us-east-1:000000000000:key/00000000-0000-0000-0000-000000000000" }
  }
  mock_resource "aws_iam_role" {
    defaults = { arn = "arn:aws:iam::000000000000:role/mock" }
  }
  mock_resource "aws_cloudwatch_log_group" {
    defaults = { arn = "arn:aws:logs:us-east-1:000000000000:log-group:mock" }
  }
  mock_resource "aws_sns_topic" {
    defaults = { arn = "arn:aws:sns:us-east-1:000000000000:mock" }
  }
  mock_resource "aws_secretsmanager_secret" {
    defaults = { arn = "arn:aws:secretsmanager:us-east-1:000000000000:secret:mock" }
  }
  mock_resource "aws_lb" {
    defaults = {
      arn        = "arn:aws:elasticloadbalancing:us-east-1:000000000000:loadbalancer/app/mock/0"
      arn_suffix = "app/mock/0"
    }
  }
  mock_resource "aws_lb_listener" {
    defaults = { arn = "arn:aws:elasticloadbalancing:us-east-1:000000000000:listener/app/mock/0/0" }
  }
  mock_resource "aws_lb_target_group" {
    defaults = {
      arn        = "arn:aws:elasticloadbalancing:us-east-1:000000000000:targetgroup/mock/0"
      arn_suffix = "targetgroup/mock/0"
    }
  }
  mock_resource "aws_db_instance" {
    defaults = {
      arn     = "arn:aws:rds:us-east-1:000000000000:db:mock"
      address = "mock.abc.us-east-1.rds.amazonaws.com"
    }
  }
  mock_resource "aws_db_proxy" {
    defaults = { endpoint = "mock.proxy-abc.us-east-1.rds.amazonaws.com" }
  }
  mock_resource "aws_acm_certificate" {
    defaults = {
      arn = "arn:aws:acm:us-east-1:000000000000:certificate/mock"
      domain_validation_options = [
        { domain_name = "web.treowallet.example", resource_record_name = "_a.web.treowallet.example.", resource_record_type = "CNAME", resource_record_value = "_a.acm-validations.aws." },
        { domain_name = "api.treowallet.example", resource_record_name = "_b.api.treowallet.example.", resource_record_type = "CNAME", resource_record_value = "_b.acm-validations.aws." },
      ]
    }
  }
  mock_resource "aws_sesv2_email_identity" {
    defaults = {
      arn                     = "arn:aws:ses:us-east-1:000000000000:identity/mock"
      dkim_signing_attributes = { tokens = ["token1", "token2", "token3"] }
    }
  }
}

mock_provider "aws" {
  alias = "us_east_1"

  mock_data "aws_iam_policy_document" {
    defaults = { json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}" }
  }
  mock_resource "aws_acm_certificate" {
    defaults = {
      arn = "arn:aws:acm:us-east-1:000000000000:certificate/mock"
      domain_validation_options = [
        { domain_name = "web.treowallet.example", resource_record_name = "_a.web.treowallet.example.", resource_record_type = "CNAME", resource_record_value = "_a.acm-validations.aws." },
        { domain_name = "api.treowallet.example", resource_record_name = "_b.api.treowallet.example.", resource_record_type = "CNAME", resource_record_value = "_b.acm-validations.aws." },
      ]
    }
  }
  mock_resource "aws_wafv2_web_acl" {
    defaults = { arn = "arn:aws:wafv2:us-east-1:000000000000:global/webacl/mock/0" }
  }
  mock_resource "aws_cloudwatch_log_group" {
    defaults = { arn = "arn:aws:logs:us-east-1:000000000000:log-group:aws-waf-logs-mock" }
  }
}

mock_provider "aws" {
  alias = "dr"

  mock_resource "aws_kms_key" {
    defaults = { arn = "arn:aws:kms:us-west-2:000000000000:key/00000000-0000-0000-0000-000000000000" }
  }
}

# random no se simula: corre local, sin credenciales, y los proveedores simulados todavía no
# admiten recursos efímeros (las contraseñas).

# prod deja sin declarar dos valores que deben decidirse (ver environments/prod.tfvars); aquí se
# fijan solo para la prueba. En dev y staging estos valores se sobrescriben con los mismos del archivo.
variables {
  audit_retention_days = 1
  clabe_bank_code      = "999"
  # Un solo dominio para que los registros de validación simulados de ACM coincidan.
  domain_name = "treowallet.example"
}

run "stack_completo" {
  command = apply

  assert {
    condition     = output.web_url == "https://${var.web_subdomain}.${var.domain_name}"
    error_message = "La web se publica en web.<dominio>."
  }

  assert {
    condition     = output.api_url == "https://${var.api_subdomain}.${var.domain_name}"
    error_message = "La API se publica en api.<dominio>."
  }

  assert {
    condition     = toset(keys(output.ecs_task_definition_families)) == toset(["api", "web", "migrations", "bootstrap"])
    error_message = "Hay cuatro definiciones de tarea: dos servicios y dos tareas puntuales de la base."
  }

  assert {
    condition     = toset(keys(output.ecs_service_names)) == toset(["api", "web"])
    error_message = "Solo la API y el BFF son servicios de larga vida."
  }

  assert {
    condition     = length(output.database_task_network.subnets) == var.az_count
    error_message = "Las tareas de la base corren en las subredes privadas de cada zona."
  }
}
