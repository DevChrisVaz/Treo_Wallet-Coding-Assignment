# API de la billetera (`/api`)

Backend de la billetera digital en MXN: identidad (registro con verificación por correo, sesiones con refresh rotativo), cuentas con CLABE y bitácora de auditoría inmutable. Express 5 + TypeScript estricto + PostgreSQL 16 con TypeORM (sin `synchronize`, migraciones con SQL explícito).

El contrato es [`contract/openapi.yaml`](../contract/openapi.yaml) (paquete `@devchrisvaz/wallet-contract`). Especificación: `openspec/changes/api-foundation/` (requisitos PLT, IDN, AUD y ACC-01 a ACC-09).

## Requisitos

- **Node.js 24** para desarrollo y pruebas (Vitest 5 pide Node ≥ 22). El build corre en Node ≥ 20.
- **Docker** con Compose (PostgreSQL 16 y Mailpit).
- `psql` es opcional: si no está instalado, `db:bootstrap` usa el de la imagen de PostgreSQL.

## Puesta en marcha

```bash
# 0. El paquete del contrato se instala como copia (file:../contract + install-links=true):
(cd ../contract && npm ci && npm run build)

# 1. Dependencias y configuración
npm ci
cp .env.example .env           # valores SOLO de desarrollo

# 2. PostgreSQL (puerto 5433 del host) y Mailpit (SMTP 1025, bandeja 8025)
docker compose up -d --wait

# 3. Roles, bases y esquema (superusuario, idempotente)
npm run db:bootstrap

# 4. Esquema y datos demo
npm run db:migrate
npm run db:seed

# 5. API en http://localhost:4000 (escucha en 0.0.0.0 para la app móvil en la red local)
npm run dev
```

| URL                                | Qué es                                                      |
| ---------------------------------- | ----------------------------------------------------------- |
| http://localhost:4000/health       | Salud del servicio                                          |
| http://localhost:4000/docs         | Swagger UI del contrato (fuera de producción)               |
| http://localhost:4000/openapi.yaml | El contrato tal cual (fuera de producción)                  |
| http://localhost:8025              | Bandeja de Mailpit: aquí llegan los códigos de verificación |

### Credenciales demo

| Usuario          | Email              | Contraseña        |
| ---------------- | ------------------ | ----------------- |
| Ana Gómez Cruz   | `ana@example.com`  | `Ana-demo-2026!`  |
| Luis Pérez López | `luis@example.com` | `Luis-demo-2026!` |

Ambos están verificados y tienen sus cuentas "Principal" y "Ahorro". Sus CURP y RFC son sintéticos.

### Registro manual

`POST /auth/register` responde 202 siempre; el código de 6 dígitos llega a la bandeja de Mailpit y se confirma con `POST /auth/verify-email`, que devuelve la sesión y abre las dos cuentas.

## Scripts

| Script                                  | Qué hace                                                                                                                                                                                                                      |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dev`                                   | API con recarga (tsx) leyendo `.env`                                                                                                                                                                                          |
| `build` / `start`                       | Compila a `dist/` y lo ejecuta con Node                                                                                                                                                                                       |
| `db:bootstrap`                          | `db/bootstrap.sql` con psql como superusuario (`BOOTSTRAP_DATABASE_URL`): roles `wallet_migrator` y `wallet_app`, bases `wallet` y `wallet_test`, esquema `app`. Las contraseñas de los roles llegan por variables de entorno |
| `db:migrate`                            | Aplica migraciones pendientes con el rol dueño (`MIGRATION_DATABASE_URL`)                                                                                                                                                     |
| `db:revert`                             | Revierte la última migración; `npm run db:revert -- --all` revierte todas                                                                                                                                                     |
| `db:seed`                               | Usuarios demo (idempotente)                                                                                                                                                                                                   |
| `lint`, `typecheck`, `format:check`     | ESLint (incluye la regla de capas), TypeScript, Prettier                                                                                                                                                                      |
| `test`, `test:unit`, `test:integration` | Vitest                                                                                                                                                                                                                        |

## Base de datos y privilegios

- `wallet_migrator` es dueño de las bases y del esquema `app`: ejecuta migraciones y seed.
- `wallet_app` es el rol de la API: no es dueño de nada y cada migración le otorga solo lo necesario, tabla por tabla. Ninguna tabla le otorga `DELETE` ni `TRUNCATE`; `audit_log` solo le permite `INSERT`. La API se niega a arrancar si `DATABASE_URL` usa el dueño del esquema o un superusuario.
- Toda constraint, índice y trigger tiene nombre con prefijo (`pk_`, `fk_`, `uq_`, `ck_`, `ix_`, `tg_`) y los errores de PostgreSQL se traducen por ese nombre.

## Pruebas

```bash
npm test                 # unitarias e integración
npm run test:unit        # sin base de datos
npm run test:integration # contra PostgreSQL real (wallet_test) y Mailpit
```

Las pruebas de integración necesitan `docker compose up -d` y `npm run db:bootstrap`; el global setup aplica las migraciones en `wallet_test` con el rol dueño. El código bajo prueba usa la conexión `wallet_app` y el arnés reinicia los datos antes de cada prueba con la conexión del dueño. Cada respuesta HTTP se valida contra `openapi.yaml` con Ajv (`expectToMatchContract`). El título de cada prueba empieza con el ID del requisito que verifica.

## Estructura por capas

```
src/
  modules/
    identity/   domain (CURP, RFC, teléfono) · application (casos de uso y puertos) · infrastructure (PostgreSQL, argon2, JWT, rutas)
    accounts/   domain (CLABE) · application (apertura de cuentas) · infrastructure
    audit/      domain (catálogo de eventos) · application (puerto) · infrastructure (escritor en PostgreSQL)
  platform/     config, contexto de petición, http (app, errores RFC 9457, validación, auth, rate limit, docs), logging, mail, persistencia
  shared/       núcleo sin dependencias: errores de dominio, Clock, transacción opaca, enmascarado
  composition.ts  raíz de composición con inyección manual
  main.ts         arranque del proceso
migrations/     migraciones TypeORM con SQL explícito (constraints, funciones, triggers y GRANTs)
db/             bootstrap.sql
test/           unit/, integration/, helpers/ (arnés, contrato, reloj falso, correo en memoria), vectors/
```

Reglas (las hace cumplir ESLint): el dominio no importa Express, TypeORM ni adaptadores; la aplicación depende de puertos, no de infraestructura; los handlers HTTP solo validan, llaman al caso de uso y traducen el resultado.
