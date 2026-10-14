## 1. Propuesta de despliegue en AWS (`/docs/aws-deploy.md`)

- [ ] 1.1 [docs] Revisar con el usuario las decisiones D1–D12 de design.md y registrar en el ai-log cualquier cambio respecto a lo propuesto (Fase 4)
- [x] 1.2 [docs] Escribir el diagrama de arquitectura en Mermaid: CloudFront + WAF, ALB, ECS Fargate (API y BFF), RDS Multi-AZ, RDS Proxy, ElastiCache, SES, S3 con Object Lock, CloudTrail, CloudWatch/X-Ray, Secrets Manager/KMS, subredes públicas y privadas (Fase 4: diagrama)
- [x] 1.3 [docs] Redactar la sección de cómputo de la API (ECS Fargate frente a App Runner, EKS y Lambda + API Gateway) y la ejecución de migraciones como tarea puntual con `wallet_migrator` (Fase 4: Cómputo de la API; AUD)
- [x] 1.4 [docs] Redactar la sección de base de datos: RDS for PostgreSQL Multi-AZ frente a Aurora, PITR, copia de backups entre regiones y tabla de RPO/RTO como objetivos a validar (Fase 4: Base de datos)
- [x] 1.5 [docs] Redactar la sección de frontend web: por qué el BFF necesita servidor, Next.js en Fargate detrás de CloudFront frente a S3 + CloudFront y Amplify Hosting, `serverActions.allowedOrigins` y confianza en `X-Forwarded-For` (Fase 4: Frontend web; WEB)
- [x] 1.6 [docs] Redactar la sección de app móvil: EAS Build y Submit, EAS Update con firma, TLS, WAF, sin secretos en el binario y lo descartado (pinning, App Attest) (Fase 4: App móvil; MOB)
- [x] 1.7 [docs] Redactar la sección de observabilidad y auditoría: CloudWatch, OpenTelemetry + X-Ray, CloudTrail, `audit_log` en caliente en RDS y exportado a S3 con Object Lock en modo compliance, tabla de retenciones con el plazo legal marcado como pendiente de cumplimiento (Fase 4: Observabilidad y auditoría; AUD)
- [x] 1.8 [docs] Redactar la sección de CI/CD: un pipeline por proyecto con filtros de rutas, OIDC, ambientes dev/staging/prod con aprobación en prod, flujo de despliegue de la API y publicación del contrato al separar repositorios (Fase 4: CI/CD)
- [x] 1.9 [docs] Redactar las secciones de soporte: ElastiCache para sesiones y rate limiting, SES, Secrets Manager/KMS con rotación del secreto JWT, Amazon Time Sync para el límite diario (Fase 4; IDN, TRF)
- [x] 1.10 [docs] Responder por escrito: manejo de conexiones al escalar (pool por tarea, fórmula de tamaño, RDS Proxy, timeouts) (Fase 4: pregunta 1)
- [x] 1.11 [docs] Responder por escrito: qué cambiaría con 100x (réplicas, particionado de `ledger_entries`, cuentas calientes y Tesorería, outbox, `idempotency_keys`, Aurora, WAF) (Fase 4: pregunta 2; HIS, TRF)
- [x] 1.12 [docs] Responder por escrito: herramienta de IaC (Terraform frente a CDK y SAM) y aclarar que el esqueleto queda fuera (Fase 4: pregunta 3)
- [x] 1.13 [docs] Revisar que cada fila de la tabla de la Fase 4 y las tres preguntas estén respondidas y que el diagrama renderice en GitHub (Fase 4)

## 2. Trazabilidad (`scripts/trace.sh`)

- [x] 2.1 [docs] Implementar la lectura de requisitos `### Requirement: XXX-NN` desde `openspec/specs/**/spec.md` y `openspec/changes/**/specs/**/spec.md` (todas las capabilities)
- [x] 2.2 [docs] Implementar la lectura de tareas con IDs desde `openspec/changes/**/tasks.md`, incluido `archive/`
- [x] 2.3 [docs] Implementar la lectura de commits con los trailers `Task:` y `Refs:` vía `git log --format='%(trailers…)'`
- [x] 2.4 [docs] Implementar la búsqueda de pruebas cuyo título empieza con un ID en `contract/`, `api/`, `web/` y `mobile/` (excluyendo `node_modules`)
- [x] 2.5 [docs] Generar la tabla Markdown `ID | Requisito | Change | Tareas | Commits | Pruebas` y la sección de huecos; agregar la opción `--check` que termina con error si hay huecos
- [x] 2.6 [docs] Ejecutar `scripts/trace.sh --check` sobre el repositorio, corregir o documentar cada hueco y guardar la salida en `docs/traceability.md`

## 3. README raíz

- [x] 3.1 [docs] README raíz único que reúne la información de los README de los cinco proyectos en secciones comunes: qué incluye, estructura y desviaciones del enunciado (sin `/specs`, sin monorepo, web con BFF en lugar de S3 + CloudFront), arquitectura, requisitos, instalación de todos los proyectos, configuración, ejecución en local con los usuarios demo, pruebas (incluidas las de integración contra PostgreSQL real y las de concurrencia), scripts, cómo funciona, verificaciones manuales, especificación y avisos conocidos; la nota de alcance enlazada al ai-log y, al final, una sola sección "¿Qué haría con más tiempo?" con la lista acordada actualizada. Los README de cada proyecto se conservan (PLT, MOB, TRF)
- [x] 3.2 [docs] Escribir el Mapa de la especificación: tabla HU1–HU6 → IDs de requisito → change → secciones de tareas, con enlace a `docs/traceability.md` y a `openspec/specs/` (todas las capabilities)
- [x] 3.3 [docs] Escribir la sección de decisiones clave con enlaces a los `design.md` de cada change (archivados)

## 4. Bitácora de AI y video

- [x] 4.1 [docs] Completar `docs/ai-log.md` con una entrada por sesión de implementación, las correcciones hechas a la AI (destacando cualquier propuesta insegura o incorrecta con el dinero) y un resumen final del flujo spec-first
- [x] 4.2 [docs] Escribir el guion del video en `docs/video-script.md` según D15, incluido el intento con saldo insuficiente, la bandeja de Mailpit y la pérdida de red en móvil (TRF, WEB, MOB)
- [ ] 4.3 [docs] Grabar el video (≤ 5 min) siguiendo el guion y enlazarlo en el README

## 5. Verificación final

- [ ] 5.1 [docs] Verificar con `gh run list --branch main` que los workflows de `contract`, `api`, `web` y `mobile` están en verde y agregar sus badges al README
- [x] 5.2 [docs] Verificar desde un clon limpio que el arranque local del README funciona de principio a fin (incluida la documentación OpenAPI navegable en Swagger UI) y corregir el README si algo falla (PLT)
- [x] 5.3 [docs] Recorrer el checklist de entregables del enunciado (repositorio con historial completo sin squash, especificaciones, aws-deploy.md, OpenAPI navegable, instrucciones de la app móvil, video, README, CI en verde) y anotar en el README dónde está cada uno
