output "alarm_topic_arn" {
  description = "Tema SNS de las alarmas."
  value       = aws_sns_topic.alarms.arn
}
