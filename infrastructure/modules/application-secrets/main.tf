# Secretos de firma de la API (docs/aws-deploy.md, sección 6): JWT_SECRET, OTP_HMAC_SECRET y
# CURSOR_SIGNING_SECRET. La API exige base64 que decodifique a 32 bytes o más (PLT-08): 64
# caracteres alfanuméricos son base64 válido y decodifican a 48 bytes.
#
# Son efímeros y de solo escritura: no quedan en el estado. Aumentar `secrets_version` los regenera.
# Hoy la API acepta un único JWT_SECRET, así que rotarlo cierra todas las sesiones.

ephemeral "random_password" "jwt" {
  length  = 64
  special = false
}

ephemeral "random_password" "otp_hmac" {
  length  = 64
  special = false
}

ephemeral "random_password" "cursor_signing" {
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret" "this" {
  name                    = "${var.name_prefix}/api/signing"
  description             = "Secretos de firma de la API: JWT, OTP y cursores"
  kms_key_id              = var.kms_key_arn
  recovery_window_in_days = var.secret_recovery_window_days
}

resource "aws_secretsmanager_secret_version" "this" {
  secret_id = aws_secretsmanager_secret.this.id
  secret_string_wo = jsonencode({
    jwt_secret            = ephemeral.random_password.jwt.result
    otp_hmac_secret       = ephemeral.random_password.otp_hmac.result
    cursor_signing_secret = ephemeral.random_password.cursor_signing.result
  })
  secret_string_wo_version = var.secrets_version
}
