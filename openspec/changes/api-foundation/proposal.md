## Why

La billetera necesita una base de backend confiable antes de mover dinero: identidad verificada, errores y logs consistentes, roles de base de datos de privilegio mínimo y una bitácora de auditoría inmutable. Sin esa base, `api-ledger` (transferencias, saldos e historial) no tendría dónde apoyarse para garantizar que "el dinero siempre cuadra" ni para auditarlo.

**Proyectos que toca:** `/api` (y su workflow de CI en `.github/workflows/api.yml`). Consume `contract/openapi.yaml` a través del paquete `@morgandevchrisvaz/wallet-contract` (definido en `contract-v1`) solo para Swagger UI y pruebas de contrato.

**Historias de usuario del enunciado que cubre:**
- **HU1** (registro e inicio de sesión), completa: registro con verificación por correo, login, refresh rotativo, logout.
- **HU2** (ver mis cuentas), parcialmente: apertura de las cuentas "Principal" y "Ahorro" con su CLABE al verificar el correo. Saldos y el endpoint `GET /accounts` llegan en `api-ledger`.
- **HU3** (beneficiarios), parcialmente: la función de base de datos que valida el dígito verificador de la CLABE, que `api-ledger` reutiliza en `beneficiaries`.
- **HU6** (OTP), parcialmente: la tabla de códigos de un solo uso y el puerto de correo que `api-ledger` usará para el OTP de transferencias.

## What Changes

- Proyecto `/api` nuevo: Node.js ≥ 20, Express, TypeScript estricto, estructura por capas (dominio, aplicación, infraestructura) donde la lógica de negocio no vive en los handlers HTTP.
- Entorno local reproducible: `docker-compose` con PostgreSQL ≥ 15 y Mailpit; scripts `db:bootstrap`, `db:migrate`, `db:seed`, `dev` y `test`.
- Base de datos con dos roles: `wallet_migrator` (dueño del esquema, ejecuta migraciones y seed) y `wallet_app` (rol de ejecución de la API, privilegio mínimo). Migraciones TypeORM con `synchronize` desactivado y SQL crudo para constraints, funciones, triggers y GRANTs.
- Plataforma HTTP: errores RFC 9457 con `code` y `requestId`, traducción de errores de PostgreSQL por nombre de constraint, logs JSON con enmascarado de datos sensibles, `X-Request-Id` propagado, confianza en `X-Forwarded-For` solo desde el BFF o el ALB, rate limiting en memoria, `/health`, Swagger UI en `/docs` y `/openapi.yaml` fuera de producción.
- Identidad: registro que responde 202 siempre, verificación de correo por código, login con respuesta genérica y tiempo constante, access token JWT de 10 minutos, refresh token opaco con rotación por familia, detección de reuso y ventana de gracia, logout y `GET /me` con datos enmascarados. CURP, RFC y teléfono obligatorios y únicos (validación de formato, sin KYC).
- Códigos de un solo uso compartidos (`one_time_codes`) para verificación de correo y, en `api-ledger`, para confirmación de transferencias. Puerto de correo con adaptador SMTP (Mailpit local, SES en AWS).
- Bitácora de auditoría solo de inserción, sin llaves foráneas ni datos personales, escrita en la misma transacción que el cambio de negocio, protegida por permisos y por triggers de respaldo.
- Tabla de cuentas con cuentas de usuario y la cuenta de sistema "Tesorería", CLABE generada con dígito verificador validado también en la base, y apertura automática de "Principal" y "Ahorro" al verificar el correo.
- Arnés de pruebas: unitarias, de integración contra PostgreSQL real (con una conexión como `wallet_migrator` para reiniciar y otra como `wallet_app` para el código), de privilegios y de contrato (cada respuesta validada contra el yaml).
- CI propio en GitHub Actions que se dispara con cambios en `api/**` o `contract/**`.

## Capabilities

### New Capabilities

- `api-platform`: comportamiento transversal de la API: formato de errores, logs y enmascarado, identificador de petición, configuración, rate limiting, documentación navegable, salud, entorno local y roles de base de datos.
- `identity`: registro, verificación de correo, inicio y cierre de sesión, tokens de acceso y de refresco, datos del usuario autenticado.
- `audit-trail`: bitácora de eventos de negocio y seguridad, inmutable y escrita de forma atómica con la operación que registra.
- `accounts`: apertura de cuentas de usuario y de la cuenta de sistema, y asignación y validación de CLABE (requisitos ACC-01 a ACC-09; `api-ledger` agrega saldos, límite diario y fondeo a partir de ACC-10).

### Modified Capabilities

(ninguna; es el primer change del backend)

## Impact

- **Código nuevo:** todo el proyecto `/api` (estructura, migraciones, scripts, pruebas, README propio).
- **APIs:** implementa las operaciones `healthCheck`, `registerUser`, `verifyEmail`, `resendVerificationEmail`, `login`, `refreshSession`, `logout` y `getCurrentUser` de `contract/openapi.yaml`.
- **Dependencias:** consume el paquete del contrato con `file:../contract` e `install-links=true`. Dependencias externas: PostgreSQL ≥ 15 y un servidor SMTP (Mailpit en local).
- **Habilita a `api-ledger`:** tabla `accounts`, función `clabe_is_valid()`, tabla `one_time_codes`, puerto de correo, escritor de auditoría, puerto de reloj, traducción de errores y arnés de pruebas.
- **Clientes:** `web-app` y `mobile-app` dependen de los endpoints de identidad y del comportamiento de refresh (incluida la ventana de gracia).
