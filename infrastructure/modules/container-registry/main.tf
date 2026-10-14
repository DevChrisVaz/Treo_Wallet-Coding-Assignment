# Repositorios de ECR para las imágenes de la API y del BFF (docs/aws-deploy.md, sección 1):
# etiquetas inmutables (una etiqueta siempre es la misma imagen), escaneo al subir y cifrado con KMS.
# La imagen de la API sirve también para las tareas de migraciones y de bootstrap.

resource "aws_ecr_repository" "this" {
  for_each = toset(var.repositories)

  name                 = "${var.name_prefix}/${each.value}"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = false

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = var.kms_key_arn
  }
}

resource "aws_ecr_lifecycle_policy" "this" {
  for_each = aws_ecr_repository.this

  repository = each.value.name
  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Borrar imágenes sin etiqueta después de 7 días"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Conservar las últimas ${var.images_to_keep} imágenes (margen de rollback)"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = var.images_to_keep
        }
        action = { type = "expire" }
      },
    ]
  })
}
