# Infraestructura en AWS (Terraform)

La propuesta de [`docs/aws-deploy.md`](../docs/aws-deploy.md) escrita como código: ECS Fargate para la API y el BFF, RDS for PostgreSQL 16 Multi-AZ con RDS Proxy, ElastiCache, CloudFront con WAF, SES, Secrets Manager y KMS, CloudTrail y un bucket de auditoría con Object Lock.

**Estado:** la configuración valida y sus pruebas pasan con proveedores simulados, pero **nunca se ha aplicado contra una cuenta real de AWS.** Tampoco existen todavía los `Dockerfile` de la API y de la web, y sin imágenes en ECR los servicios no arrancan (ver [Requisitos de las imágenes](#requisitos-de-las-imágenes)).

## Estructura

```
infrastructure/
├── bootstrap/        Una vez por cuenta: bucket del estado, llave de KMS y roles OIDC de GitHub
├── stack/            Módulo raíz de la plataforma; el mismo para dev, staging y prod
│   └── tests/        terraform test del stack completo con proveedores simulados
├── environments/     <ambiente>.tfvars y <ambiente>.s3.tfbackend
└── modules/
    ├── network/              VPC, subredes públicas, privadas y de datos, NAT, endpoints, flow logs
    ├── security-groups/      Todos los grupos de seguridad y sus reglas, en un solo lugar
    ├── certificates/         ACM regional (ALB) y en us-east-1 (CloudFront), validados por DNS
    ├── load-balancer/        ALB interno con ruteo por host y zona privada de api.<dominio>
    ├── edge/                 CloudFront con VPC origin, AWS WAF y registros públicos
    ├── database/             RDS, RDS Proxy, secretos de los tres roles, exportación a S3, copia entre regiones
    ├── cache/                ElastiCache for Redis con TLS y token
    ├── application-secrets/  JWT_SECRET, OTP_HMAC_SECRET y CURSOR_SIGNING_SECRET
    ├── email/                SES con DKIM, MAIL FROM, DMARC y credenciales SMTP
    ├── container-registry/   ECR con etiquetas inmutables y escaneo al subir
    ├── compute/              Cluster de ECS, servicios, tareas puntuales y autoescalado
    │   └── tests/            terraform test de la separación de credenciales
    ├── audit/                Bucket con Object Lock y CloudTrail
    ├── monitoring/           SNS, alarmas y métricas desde los logs JSON de la API
    └── kms/                  Llaves de datos, de logs y de auditoría
```

Cada ambiente vive en su propia cuenta de AWS, con su propio bucket de estado. `allowed_account_ids` impide aplicar el plan de un ambiente en la cuenta de otro.

| | dev | staging | prod |
|---|---|---|---|
| Zonas | 2 | 2 | 3 |
| NAT Gateway | uno | uno por zona | uno por zona |
| Endpoints de interfaz | no | sí | sí |
| RDS | `db.t4g.medium`, una zona | `db.m7g.large`, Multi-AZ | `db.m7g.large`, Multi-AZ, backups copiados a `us-west-2` |
| ElastiCache | un nodo | dos nodos | dos nodos |
| Tareas por servicio | 1 a 2, Fargate Spot | 2 a 4 | 2 a 10 (API) |
| Object Lock | GOVERNANCE, 1 día | GOVERNANCE, 30 días | COMPLIANCE, **plazo pendiente** |

Las cuentas (`000000000000`) y los dominios (`*.treowallet.example`) de `environments/` son marcadores.

## Verificar sin una cuenta de AWS

Requiere Terraform 1.11 o posterior (probado con 1.16.1). Nada de esto necesita credenciales ni crea recursos:

```bash
cd infrastructure
terraform fmt -recursive -check

cd stack
terraform init -backend=false
terraform validate
terraform test -var-file=../environments/dev.tfvars      # igual con staging y prod

cd ../modules/compute
terraform init -backend=false
terraform test

cd ../../bootstrap
terraform init -backend=false
terraform validate
terraform test
```

- **`stack/tests/stack.tftest.hcl`** simula un `apply` del stack completo con cada archivo de ambiente. Detecta lo que `validate` no ve: así se encontró que las llaves del `for_each` de la validación de ACM dependían de atributos que solo se conocen después del apply.
- **`bootstrap/tests/github-roles.tftest.hcl`** comprueba quién asume los roles de GitHub: por defecto ningún pull request, nunca en prod, y el rol de plan solo escribe el archivo de bloqueo del estado.
- **`modules/compute/tests/secrets.tftest.hcl`** comprueba la separación de credenciales: la API solo puede leer los secretos de `wallet_app`, firma, SMTP y caché; el BFF ninguno de la base; la tarea de migraciones solo el de `wallet_migrator`, y solo la de bootstrap el superusuario. También que ningún secreto llegue como variable en texto plano. Se comprobó que la prueba falla si se le da a la API el secreto de `wallet_migrator`.

El workflow [`infrastructure`](../.github/workflows/infrastructure.yml) corre estos mismos pasos en cada cambio de `infrastructure/**`.

## Primer despliegue de un ambiente

1. **Bootstrap de la cuenta**, con credenciales de administrador de esa cuenta. El estado de `bootstrap/` es local, uno por ambiente con *workspaces*:

   ```bash
   cd infrastructure/bootstrap
   terraform init
   terraform workspace new prod
   terraform apply -var environment=prod -var region=us-east-1 -var 'allowed_account_ids=["<cuenta>"]'
   ```

2. **Backend y variables.** Copiar `state_bucket` y `state_kms_key_arn` de los outputs a `environments/prod.s3.tfbackend`, y poner la cuenta y el dominio reales en `environments/prod.tfvars`. La zona pública de Route 53 del dominio debe existir en la cuenta.

3. **Decidir lo que prod deja sin valor:** `audit_retention_days` (el plazo legal de `audit_log`; en COMPLIANCE no se puede acortar después) y `clabe_bank_code` (la clave de institución asignada). `terraform plan` los pide hasta que estén en el archivo.

4. **Repositorios primero.** Los servicios necesitan una imagen para arrancar, así que el primer apply crea solo ECR:

   ```bash
   cd infrastructure/stack
   terraform init -backend-config=../environments/prod.s3.tfbackend
   terraform apply -var-file=../environments/prod.tfvars -target=module.container_registry
   ```

   Después se suben las imágenes de la API y de la web con la etiqueta que se vaya a usar en lugar de `bootstrap`.

5. **Todo lo demás:** `terraform apply -var-file=../environments/prod.tfvars -var api_image_tag=<tag> -var web_image_tag=<tag>`. CloudFront y RDS tardan varios minutos.

6. **Roles y esquema de la base**, con las tareas puntuales. Los valores de red salen del output `database_task_network`:

   ```bash
   aws ecs run-task --cluster treo-prod --task-definition treo-prod-bootstrap \
     --launch-type FARGATE \
     --network-configuration 'awsvpcConfiguration={subnets=[<subredes>],securityGroups=[<grupo>],assignPublicIp=DISABLED}'
   # esperar a que termine con exit code 0 y repetir con treo-prod-migrations
   ```

   Hasta que corre el bootstrap, RDS Proxy reporta `AUTH_FAILURE` (el rol `wallet_app` todavía no existe) y la API no pasa su verificación de arranque. El bootstrap también crea la base `wallet_test`, que en AWS no se usa.

7. **SES fuera del sandbox:** es una solicitud manual a AWS por cuenta y región. Sin ella solo se puede enviar a direcciones verificadas, y los OTP no llegan.

## Desplegar una versión

Las migraciones corren antes de actualizar el servicio (docs/aws-deploy.md, sección 1). La tarea de migraciones tiene su propia etiqueta de imagen para poder ir una versión adelante:

1. CI construye y sube las imágenes con la etiqueta nueva (las etiquetas son inmutables).
2. `terraform apply -var migrations_image_tag=<nueva>`: solo cambian las definiciones de tarea de migraciones y bootstrap.
3. `aws ecs run-task` con `treo-<ambiente>-migrations`, y se detiene el despliegue si no termina con exit code 0.
4. `terraform apply -var api_image_tag=<nueva> -var web_image_tag=<nueva>`: ECS hace el despliegue *rolling* con *circuit breaker* y rollback automático, y `apply` espera a que el servicio quede estable.

Cada paso de `apply` deja un plan revisable, que es la razón para elegir Terraform (pregunta 3). El workflow de despliegue con estos pasos todavía no está escrito; `bootstrap/` ya crea los dos roles que usaría, y los dos los asume solo un job que corre en el GitHub Environment del ambiente:

- **`github-plan`:** lectura de la cuenta y del estado. Solo escribe y borra el archivo de bloqueo (`<llave>.tflock`), así que no puede reemplazar ni borrar el estado.
- **`github-apply`:** aplica los cambios.

Leer el estado es leer la credencial SMTP (ver [Secretos](#secretos)). Por eso los pull requests no asumen el rol de plan, salvo que se active `allow_pull_request_plan`, y en prod nunca: la variable lo rechaza.

## Secretos

Las contraseñas de la base, el token de ElastiCache y los secretos de firma de la API se generan con recursos **efímeros** y se escriben en argumentos de **solo escritura** (`password_wo`, `auth_token_wo`, `secret_string_wo`): **no quedan en el estado de Terraform.** Se comprobó en el código del proveedor que, con `secret_string_wo`, la lectura de la versión del secreto no trae su valor.

Para rotarlos se aumenta la versión correspondiente y se aplica:

| Variable | Rota | Después |
|---|---|---|
| `db_credentials_version` | Superusuario, `wallet_migrator` y `wallet_app` | Correr la tarea de bootstrap (reafirma las contraseñas con `ALTER ROLE`) y reiniciar la API |
| `cache_auth_token_version` | Token de ElastiCache | Reiniciar los servicios |
| `signing_secrets_version` | `JWT_SECRET`, `OTP_HMAC_SECRET`, `CURSOR_SIGNING_SECRET` | Reiniciar la API. Cierra todas las sesiones: la API acepta un solo `JWT_SECRET` |

**Excepción declarada:** SES por SMTP exige la llave de un usuario de IAM, y esa llave y la contraseña SMTP derivada sí quedan en el estado (el bucket está cifrado con KMS y su acceso es restringido). Se rotan con `terraform apply -replace=module.email.aws_iam_access_key.smtp`. Quien puede leer el estado puede leer esa credencial; de ahí las restricciones del rol de plan.

## Requisitos de las imágenes

No hay `Dockerfile` en el repositorio. La configuración asume que las imágenes cumplen esto:

| Imagen | Requisito |
|---|---|
| API | Escucha en `0.0.0.0:4000` y responde `GET /health`. Sistema de archivos raíz de solo lectura: solo `/tmp` es escribible |
| API | Incluye el bundle de CAs de RDS en `/etc/ssl/certs/rds-global-bundle.pem` (las migraciones y el bootstrap entran directo a RDS con `sslmode=verify-full`; la API entra por RDS Proxy, cuyo certificado ya es de una CA pública) |
| API | Para las tareas puntuales: `dist/scripts/db-migrate.js`, `dist/scripts/db-bootstrap.js`, el cliente `psql` y `db/bootstrap.sql` donde el script lo busca (`tsc` no copia el `.sql` a `dist/`). Los comandos se cambian con `migrations_command` y `bootstrap_command` del módulo `compute` |
| Web | `next start` en `0.0.0.0:3000` y `GET /login` responde 200 |
| Ambas | Arquitectura `X86_64` (o `ARM64` con `cpu_architecture`) y un usuario sin privilegios |

## Decisiones y diferencias con docs/aws-deploy.md

- **El ALB es interno.** El documento original lo ponía en subredes públicas, aceptando solo los rangos de CloudFront. Aquí CloudFront entra por un **VPC origin** y el ALB no tiene IP pública; la lista de prefijos de CloudFront se mantiene en su grupo de seguridad. El BFF llama a `https://api.<dominio>`, que dentro de la VPC resuelve al ALB por una zona privada de Route 53: el certificado es el mismo y la llamada no sale de la red.
- **Zonas excluidas:** CloudFront no admite VPC origins en algunas zonas (por ejemplo `use1-az3` en us-east-1), así que el módulo de red las descarta por ID. mx-central-1 sí admite VPC origins, por si se prefiere mantener los datos en México; falta confirmar ahí la disponibilidad de RDS Proxy y de SES.
- **`TRUSTED_PROXIES`** de la API son los rangos de las subredes privadas, donde están el ALB, las interfaces del VPC origin y el BFF.
- **Tres capas de subredes:** RDS y ElastiCache están en subredes sin ruta a internet.
- **Redis lo usa la web, todavía no la API.** Con `REDIS_URL`, el BFF guarda sus sesiones en ElastiCache (WEB-37, `web/lib/server/redis-session-store.ts`), así que cualquier tarea del BFF atiende cualquier sesión. La afinidad por cookie del ALB (`web_sticky_sessions`) queda apagada por defecto; solo hace falta si el BFF corre sin `REDIS_URL`. El rate limiting de la API sigue contando en memoria: el límite de intentos de login es por tarea y, con dos tareas, el límite efectivo se duplica. La primera barrera sigue siendo la regla por tasa de WAF.
- **WAF:** límite por IP en `/auth/*`, `/login` y `/register` (100 en 5 minutos; `/register` porque el aviso del registro revela a quien controla el correo que un dato de identidad ya tiene cuenta), límite general (2,000 en 5 minutos) y los grupos administrados de reputación de IP, reglas comunes y entradas maliciosas. Los logs ocultan `authorization` y `cookie`.
- **`audit_log` a S3:** RDS tiene asociado un rol para `aws_s3.query_export_to_s3` con permiso solo sobre `audit-log/` del bucket de auditoría. El job periódico que la invoca no está escrito.
- **Trail de la cuenta,** no de organización: el de organización vive en la cuenta de administración.
- **Alarmas** desde los logs de pino: errores, alertas de la base (`alert: true`, que incluye los `42501`) y correos fallidos (`mail delivery failed`), además de 5xx, latencia, destinos fuera de servicio, CPU y memoria, RDS, conexiones ancladas en RDS Proxy y la reputación de SES.

## Pendientes

- Aplicarlo en una cuenta real. Con proveedores simulados no se prueban las cuotas, la disponibilidad de los servicios en la región ni los permisos reales.
- Los `Dockerfile` y el workflow de despliegue.
- Una política de mínimo privilegio para el rol `github-apply` en lugar de `AdministratorAccess`.
- Sacar la credencial SMTP del estado: crear la llave de acceso fuera de Terraform (o rotarla con una Lambda) y que Terraform solo cree el usuario, su política y el secreto vacío.
- La rotación automática de las contraseñas de la base con Secrets Manager: el secreto lleva la URL completa y la rotación administrada solo cambiaría `password`.
- El colector de OpenTelemetry (ADOT) como sidecar, cuando la API y el BFF tengan instrumentación.
- El rate limiting de la API en ElastiCache: el clúster y `REDIS_URL` ya están, falta que la API los use.
- El job periódico que exporta `audit_log` a S3 con `aws_s3.query_export_to_s3`.
- La regla CAPTCHA de WAF para el registro que propone [`docs/aws-deploy.md`](../docs/aws-deploy.md#6-servicios-de-soporte): necesita que la página de registro integre el acertijo, así que no está en el web ACL.
