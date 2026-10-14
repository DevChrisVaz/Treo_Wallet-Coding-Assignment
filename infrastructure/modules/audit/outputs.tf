output "bucket_arn" {
  description = "ARN del bucket de auditoría."
  value       = aws_s3_bucket.this.arn
}

output "bucket_name" {
  description = "Nombre del bucket de auditoría."
  value       = aws_s3_bucket.this.id
}

output "trail_arn" {
  description = "ARN del trail de CloudTrail."
  value       = aws_cloudtrail.this.arn
}
