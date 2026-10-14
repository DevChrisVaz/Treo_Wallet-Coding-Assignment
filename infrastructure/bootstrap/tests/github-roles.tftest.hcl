# Quién puede asumir los roles de GitHub y qué pueden hacer con el estado. Corre con un proveedor
# simulado, sin credenciales de AWS.

mock_provider "aws" {
  mock_data "aws_partition" {
    defaults = { partition = "aws" }
  }
  mock_data "aws_caller_identity" {
    defaults = { account_id = "000000000000" }
  }
  mock_data "aws_iam_policy_document" {
    defaults = { json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}" }
  }
  mock_resource "aws_kms_key" {
    defaults = { arn = "arn:aws:kms:us-east-1:000000000000:key/00000000-0000-0000-0000-000000000000" }
  }
  mock_resource "aws_s3_bucket" {
    defaults = { arn = "arn:aws:s3:::treo-dev-tfstate-000000000000" }
  }
  mock_resource "aws_iam_openid_connect_provider" {
    defaults = { arn = "arn:aws:iam::000000000000:oidc-provider/token.actions.githubusercontent.com" }
  }
}

variables {
  environment         = "dev"
  region              = "us-east-1"
  allowed_account_ids = ["000000000000"]
}

run "los_pull_requests_no_asumen_ningun_rol_por_defecto" {
  command = plan

  assert {
    condition = alltrue([
      for role in ["plan", "apply"] :
      !contains(flatten([for c in data.aws_iam_policy_document.github_assume[role].statement[0].condition : c.values if c.variable == "token.actions.githubusercontent.com:sub"]), "repo:${var.github_repository}:pull_request")
    ])
    error_message = "Sin allow_pull_request_plan, solo un job del GitHub Environment asume los roles."
  }
}

# apply con el proveedor simulado: el ARN del bucket solo se conoce después de crearlo.
run "el_plan_solo_escribe_el_archivo_de_bloqueo" {
  command = apply

  assert {
    condition     = data.aws_iam_policy_document.state_access["plan"].statement[2].resources == toset(["${aws_s3_bucket.state.arn}/*.tflock"])
    error_message = "El rol de plan no puede reemplazar ni borrar el estado."
  }
}

run "dev_puede_habilitar_el_plan_en_pull_requests" {
  command = plan

  variables {
    allow_pull_request_plan = true
  }

  assert {
    condition     = contains(flatten([for c in data.aws_iam_policy_document.github_assume["plan"].statement[0].condition : c.values if c.variable == "token.actions.githubusercontent.com:sub"]), "repo:${var.github_repository}:pull_request")
    error_message = "Con allow_pull_request_plan, los pull requests asumen el rol de plan."
  }

  assert {
    condition     = !contains(flatten([for c in data.aws_iam_policy_document.github_assume["apply"].statement[0].condition : c.values if c.variable == "token.actions.githubusercontent.com:sub"]), "repo:${var.github_repository}:pull_request")
    error_message = "Un pull request nunca asume el rol de apply."
  }
}

run "prod_rechaza_el_plan_en_pull_requests" {
  command = plan

  variables {
    environment             = "prod"
    allow_pull_request_plan = true
  }

  expect_failures = [var.allow_pull_request_plan]
}
