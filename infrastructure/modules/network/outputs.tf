output "vpc_id" {
  description = "ID de la VPC."
  value       = aws_vpc.this.id
}

output "vpc_cidr_block" {
  description = "Rango de la VPC."
  value       = aws_vpc.this.cidr_block
}

output "public_subnet_ids" {
  description = "Subredes públicas (NAT Gateway)."
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "Subredes privadas (ECS, ALB interno, endpoints)."
  value       = aws_subnet.private[*].id
}

output "private_subnet_cidrs" {
  description = "Rangos de las subredes privadas; alimentan TRUSTED_PROXIES de la API."
  value       = aws_subnet.private[*].cidr_block
}

output "database_subnet_ids" {
  description = "Subredes de datos (RDS, RDS Proxy, ElastiCache)."
  value       = aws_subnet.database[*].id
}
