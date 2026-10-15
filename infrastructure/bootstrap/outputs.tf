output "state_bucket" {
  description = "Bucket del estado: va en environments/<ambiente>.s3.tfbackend."
  value       = aws_s3_bucket.state.id
}

output "state_kms_key_arn" {
  description = "Llave del estado: va en environments/<ambiente>.s3.tfbackend."
  value       = aws_kms_key.state.arn
}

output "github_plan_role_arn" {
  description = "Rol que asume el job de plan en GitHub Actions."
  value       = aws_iam_role.github["plan"].arn
}

output "github_apply_role_arn" {
  description = "Rol que asume el job de apply en GitHub Actions."
  value       = aws_iam_role.github["apply"].arn
}
