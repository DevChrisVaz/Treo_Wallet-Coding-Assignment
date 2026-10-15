# Amazon SES (docs/aws-deploy.md, sección 6): el mismo adaptador SMTP que usa Mailpit en local,
# con DKIM, SPF (MAIL FROM propio) y DMARC.
#
# Salir del sandbox de SES es una solicitud manual a AWS por cuenta y región; sin ella solo se
# puede enviar a direcciones verificadas.
#
# Excepción declarada: SES por SMTP exige credenciales de un usuario de IAM. La llave de acceso y
# la contraseña SMTP derivada quedan en el estado de Terraform (cifrado con KMS y de acceso
# restringido). Se rotan con `terraform apply -replace=module.email.aws_iam_access_key.smtp`.

data "aws_region" "current" {}

resource "aws_sesv2_configuration_set" "this" {
  configuration_set_name = var.name_prefix

  delivery_options {
    tls_policy = "REQUIRE"
  }

  reputation_options {
    reputation_metrics_enabled = true
  }

  sending_options {
    sending_enabled = true
  }
}

# Rebotes, quejas y rechazos como métricas de CloudWatch (alarma de fallos de envío de OTP).
resource "aws_sesv2_configuration_set_event_destination" "cloudwatch" {
  configuration_set_name = aws_sesv2_configuration_set.this.configuration_set_name
  event_destination_name = "cloudwatch"

  event_destination {
    enabled              = true
    matching_event_types = ["SEND", "REJECT", "BOUNCE", "COMPLAINT", "DELIVERY_DELAY", "RENDERING_FAILURE"]

    cloud_watch_destination {
      dimension_configuration {
        dimension_name          = "ses:configuration-set"
        dimension_value_source  = "MESSAGE_TAG"
        default_dimension_value = var.name_prefix
      }
    }
  }
}

resource "aws_sesv2_email_identity" "domain" {
  email_identity         = var.domain_name
  configuration_set_name = aws_sesv2_configuration_set.this.configuration_set_name

  dkim_signing_attributes {
    next_signing_key_length = "RSA_2048_BIT"
  }
}

resource "aws_route53_record" "dkim" {
  count = 3

  zone_id = var.zone_id
  name    = "${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}._domainkey.${var.domain_name}"
  type    = "CNAME"
  ttl     = 1800
  records = ["${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}.dkim.amazonses.com"]
}

resource "aws_sesv2_email_identity_mail_from_attributes" "domain" {
  email_identity         = aws_sesv2_email_identity.domain.email_identity
  mail_from_domain       = "mail.${var.domain_name}"
  behavior_on_mx_failure = "REJECT_MESSAGE"
}

resource "aws_route53_record" "mail_from_mx" {
  zone_id = var.zone_id
  name    = aws_sesv2_email_identity_mail_from_attributes.domain.mail_from_domain
  type    = "MX"
  ttl     = 1800
  records = ["10 feedback-smtp.${data.aws_region.current.region}.amazonses.com"]
}

resource "aws_route53_record" "mail_from_spf" {
  zone_id = var.zone_id
  name    = aws_sesv2_email_identity_mail_from_attributes.domain.mail_from_domain
  type    = "TXT"
  ttl     = 1800
  records = ["v=spf1 include:amazonses.com -all"]
}

resource "aws_route53_record" "dmarc" {
  zone_id = var.zone_id
  name    = "_dmarc.${var.domain_name}"
  type    = "TXT"
  ttl     = 1800
  records = ["v=DMARC1; p=${var.dmarc_policy}; rua=mailto:${var.dmarc_report_address}; adkim=s; aspf=s"]
}

# --- Credenciales SMTP ---

data "aws_iam_policy_document" "smtp" {
  statement {
    actions   = ["ses:SendRawEmail"]
    resources = [aws_sesv2_email_identity.domain.arn, aws_sesv2_configuration_set.this.arn]
  }
}

resource "aws_iam_user" "smtp" {
  name = "${var.name_prefix}-ses-smtp"
}

resource "aws_iam_user_policy" "smtp" {
  name   = "send-email"
  user   = aws_iam_user.smtp.name
  policy = data.aws_iam_policy_document.smtp.json
}

resource "aws_iam_access_key" "smtp" {
  user = aws_iam_user.smtp.name
}

resource "aws_secretsmanager_secret" "smtp" {
  name                    = "${var.name_prefix}/smtp"
  description             = "Credenciales SMTP de Amazon SES"
  kms_key_id              = var.kms_key_arn
  recovery_window_in_days = var.secret_recovery_window_days
}

resource "aws_secretsmanager_secret_version" "smtp" {
  secret_id = aws_secretsmanager_secret.smtp.id
  secret_string = jsonencode({
    user     = aws_iam_access_key.smtp.id
    password = aws_iam_access_key.smtp.ses_smtp_password_v4
  })
}
