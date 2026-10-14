output "arn" {
  description = "ARN del ALB (origen de CloudFront)."
  value       = aws_lb.this.arn
}

output "dns_name" {
  description = "Nombre DNS interno del ALB."
  value       = aws_lb.this.dns_name
}

output "arn_suffix" {
  description = "Sufijo del ARN, para las métricas de CloudWatch."
  value       = aws_lb.this.arn_suffix
}

# Los servicios de ECS no pueden registrarse en un grupo que aún no está en una regla del listener.
output "api_target_group_arn" {
  description = "Grupo de destino de la API."
  value       = aws_lb_target_group.api.arn
  depends_on  = [aws_lb_listener_rule.api]
}

output "api_target_group_arn_suffix" {
  description = "Sufijo del grupo de destino de la API, para métricas y autoescalado."
  value       = aws_lb_target_group.api.arn_suffix
}

output "web_target_group_arn" {
  description = "Grupo de destino del BFF."
  value       = aws_lb_target_group.web.arn
  depends_on  = [aws_lb_listener_rule.web]
}

output "web_target_group_arn_suffix" {
  description = "Sufijo del grupo de destino del BFF, para métricas y autoescalado."
  value       = aws_lb_target_group.web.arn_suffix
}
