# Separación de credenciales (docs/aws-deploy.md, sección 1): cada tarea recibe y puede leer solo
# sus secretos. Corre con proveedores simulados, sin credenciales de AWS.

mock_provider "aws" {
  mock_data "aws_partition" {
    defaults = {
      partition = "aws"
    }
  }

  # El proveedor valida que las políticas sean JSON aun con datos simulados.
  mock_data "aws_iam_policy_document" {
    defaults = {
      json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}"
    }
  }
}

variables {
  name_prefix                 = "treo-test"
  region                      = "us-east-1"
  subnet_ids                  = ["subnet-a", "subnet-b"]
  api_security_group_id       = "sg-api"
  web_security_group_id       = "sg-web"
  api_target_group_arn        = "arn:aws:elasticloadbalancing:us-east-1:000000000000:targetgroup/api/1"
  web_target_group_arn        = "arn:aws:elasticloadbalancing:us-east-1:000000000000:targetgroup/web/1"
  alb_arn_suffix              = "app/treo-test/1"
  api_target_group_arn_suffix = "targetgroup/api/1"
  repository_urls = {
    api = "000000000000.dkr.ecr.us-east-1.amazonaws.com/treo-test/api"
    web = "000000000000.dkr.ecr.us-east-1.amazonaws.com/treo-test/web"
  }
  api_image_tag       = "v1"
  web_image_tag       = "v1"
  api_port            = 4000
  web_port            = 3000
  clabe_bank_code     = "999"
  clabe_plaza_code    = "180"
  smtp_host           = "email-smtp.us-east-1.amazonaws.com"
  smtp_from           = "TreoWallet <no-reply@treowallet.example>"
  trusted_proxy_cidrs = ["10.10.16.0/20", "10.10.32.0/20"]
  api_base_url        = "https://api.treowallet.example"
  web_allowed_origins = ["https://web.treowallet.example"]
  secrets = {
    database_master   = "arn:aws:secretsmanager:us-east-1:000000000000:secret:master"
    database_migrator = "arn:aws:secretsmanager:us-east-1:000000000000:secret:migrator"
    database_app      = "arn:aws:secretsmanager:us-east-1:000000000000:secret:app"
    signing           = "arn:aws:secretsmanager:us-east-1:000000000000:secret:signing"
    smtp              = "arn:aws:secretsmanager:us-east-1:000000000000:secret:smtp"
    cache             = "arn:aws:secretsmanager:us-east-1:000000000000:secret:cache"
  }
  data_kms_key_arn = "arn:aws:kms:us-east-1:000000000000:key/data"
  logs_kms_key_arn = "arn:aws:kms:us-east-1:000000000000:key/logs"
}

run "api_no_lee_credenciales_de_migrator_ni_superusuario" {
  command = plan

  assert {
    condition = toset(data.aws_iam_policy_document.execution_secrets["api"].statement[0].resources) == toset([
      var.secrets.database_app, var.secrets.signing, var.secrets.smtp, var.secrets.cache,
    ])
    error_message = "El rol de ejecución de la API solo puede leer wallet_app, firma, SMTP y caché."
  }

  assert {
    condition     = !contains(data.aws_iam_policy_document.execution_secrets["web"].statement[0].resources, var.secrets.database_app)
    error_message = "El BFF no debe poder leer ninguna credencial de la base."
  }

  assert {
    condition     = toset(data.aws_iam_policy_document.execution_secrets["migrations"].statement[0].resources) == toset([var.secrets.database_migrator])
    error_message = "La tarea de migraciones solo lee el secreto de wallet_migrator."
  }

  assert {
    condition     = contains(data.aws_iam_policy_document.execution_secrets["bootstrap"].statement[0].resources, var.secrets.database_master)
    error_message = "Solo la tarea de bootstrap recibe el superusuario."
  }
}

run "api_recibe_wallet_app_y_ningun_secreto_en_texto_plano" {
  command = plan

  assert {
    condition = one([
      for s in jsondecode(aws_ecs_task_definition.this["api"].container_definitions)[0].secrets :
      s.valueFrom if s.name == "DATABASE_URL"
    ]) == "${var.secrets.database_app}:url::"
    error_message = "DATABASE_URL de la API debe venir del secreto de wallet_app (por RDS Proxy)."
  }

  assert {
    condition = alltrue([
      for e in jsondecode(aws_ecs_task_definition.this["api"].container_definitions)[0].environment :
      length(regexall("(SECRET|PASSWORD|DATABASE_URL)", e.name)) == 0
    ])
    error_message = "Ningún secreto de la API puede ir como variable de entorno en texto plano."
  }

  assert {
    condition     = !anytrue([for s in jsondecode(aws_ecs_task_definition.this["api"].container_definitions)[0].secrets : s.name == "MIGRATION_DATABASE_URL"])
    error_message = "La API no recibe MIGRATION_DATABASE_URL: el rol dueño nunca está en una tarea de larga vida."
  }

  assert {
    condition = one([
      for e in jsondecode(aws_ecs_task_definition.this["api"].container_definitions)[0].environment :
      e.value if e.name == "TRUSTED_PROXIES"
    ]) == "10.10.16.0/20,10.10.32.0/20"
    error_message = "TRUSTED_PROXIES debe contener los rangos de las subredes del ALB y del BFF."
  }
}

run "migraciones_usan_la_etiqueta_propia_si_se_indica" {
  command = plan

  variables {
    migrations_image_tag = "v2"
  }

  assert {
    condition     = jsondecode(aws_ecs_task_definition.this["migrations"].container_definitions)[0].image == "${var.repository_urls["api"]}:v2"
    error_message = "La tarea de migraciones corre la versión nueva antes de actualizar el servicio."
  }

  assert {
    condition     = jsondecode(aws_ecs_task_definition.this["api"].container_definitions)[0].image == "${var.repository_urls["api"]}:v1"
    error_message = "El servicio de la API sigue en su versión hasta el segundo apply."
  }
}
