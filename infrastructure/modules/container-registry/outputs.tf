output "repository_urls" {
  description = "URL de cada repositorio, por nombre corto (api, web)."
  value       = { for key, repo in aws_ecr_repository.this : key => repo.repository_url }
}

output "repository_arns" {
  description = "ARN de cada repositorio, por nombre corto (api, web)."
  value       = { for key, repo in aws_ecr_repository.this : key => repo.arn }
}
