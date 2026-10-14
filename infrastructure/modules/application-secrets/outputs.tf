output "secret_arn" {
  description = "Secreto con las llaves jwt_secret, otp_hmac_secret y cursor_signing_secret."
  value       = aws_secretsmanager_secret.this.arn
}
