# API de la billetera (`/api`)

Backend de la billetera digital en MXN: identidad (registro con verificación por correo, sesiones con refresh rotativo), cuentas con CLABE, beneficiarios, transferencias con ledger de partida doble (idempotencia, límite diario, OTP por correo), historial con paginación por cursor, estado de cuenta mensual en PDF y bitácora de auditoría inmutable. Express 5 + TypeScript estricto + PostgreSQL 16 con TypeORM (sin `synchronize`, migraciones con SQL explícito).

El contrato es [`contract/openapi.yaml`](../contract/openapi.yaml) (paquete `@devchrisvaz/wallet-contract`). Especificación: `openspec/changes/api-foundation/` (requisitos PLT, IDN, AUD y ACC-01 a ACC-09) `openspec/changes/api-ledger/` (ACC-10 a ACC-16, BEN, TRF e HIS-01 a HIS-10) y `openspec/changes/account-statements/` (HIS-11, HIS-12 y AUD-07).

## Requisitos

- **Node.js 24** para desarrollo y pruebas (Vitest 5 pide Node ≥ 22). El build corre en Node ≥ 20.
- **Docker** con Compose (PostgreSQL 16 y Mailpit).
- `psql` es opcional: si no está instalado, `db:bootstrap` usa el de la imagen de PostgreSQL.

## Puesta en marcha

```bash
# 0. El contrato y el paquete de diseño se instalan como copia (file:../ + install-links=true):
(cd ../contract && npm ci && npm run build)
(cd ../design-tokens && npm ci && npm run build)

# 1. Dependencias y configuración
npm ci
cp .env.example .env           # valores SOLO de desarrollo

# 2. PostgreSQL (puerto 5433 del host) y Mailpit (SMTP 1025, bandeja 8025)
docker compose up -d --wait

# 3. Roles, bases y esquema (superusuario, idempotente)
npm run db:bootstrap

# 4. Esquema y datos demo (~120k asientos; unos 11 s en local)
npm run db:migrate
npm run db:seed

# 5. API en http://localhost:4000 (escucha en 0.0.0.0 para la app móvil en la red local)
npm run dev
```

| URL                                | Qué es                                                              |
| ---------------------------------- | ------------------------------------------------------------------- |
| http://localhost:4000/health       | Salud del servicio                                                  |
| http://localhost:4000/docs         | Swagger UI del contrato (fuera de producción)                       |
| http://localhost:4000/openapi.yaml | El contrato tal cual (fuera de producción)                          |
| http://localhost:8025              | Bandeja de Mailpit: códigos de verificación y OTP de transferencias |

### Credenciales demo

| Usuario               | Email                                             | Contraseña           |
| --------------------- | ------------------------------------------------- | -------------------- |
| Ana Gómez Cruz        | `ana@example.com`                                 | `Ana-demo-2026!`     |
| Luis Pérez López      | `luis@example.com`                                | `Luis-demo-2026!`    |
| 50 usuarios generados | `usuario01@example.com` … `usuario50@example.com` | `Demo-usuario-2026!` |

Todos están verificados y tienen sus cuentas "Principal" y "Ahorro"; sus CURP, RFC y teléfonos son sintéticos (válidos en estructura y dígito verificador, no corresponden a personas reales). Ana ya tiene registrado a Luis (alias "Luis") y a otros nueve usuarios como beneficiarios, y su "Principal" tiene unos 60,000 movimientos de los últimos 12 meses. Para probar transferencias desde cero, fondea otra cuenta con `db:fund`.

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
| `db:seed`                               | Datos de desarrollo con volumen (ver abajo). Idempotente y termina verificando las invariantes del ledger                                                                                                                     |
| `db:fund`                               | Fondea una cuenta desde la Tesorería: `npm run db:fund -- --account <id o CLABE> --amount 1000.00`                                                                                                                            |
| `lint`, `typecheck`, `format:check`     | ESLint (incluye la regla de capas), TypeScript, Prettier                                                                                                                                                                      |
| `test`, `test:unit`, `test:integration` | Vitest                                                                                                                                                                                                                        |

## Datos de desarrollo (`db:seed`)

`npm run db:seed` usa el rol dueño (`MIGRATION_DATABASE_URL`) y es idempotente: correrlo otra vez no duplica nada. Crea:

1. Ana, Luis y 50 usuarios generados, verificados, con sus dos cuentas.
2. Beneficiarios: Luis y otros nueve para Ana; "Ana" para cada uno de los demás.
3. Fondeo inicial de cada "Principal" desde la Tesorería con el mismo servicio que `db:fund` (evento `FUNDING_POSTED`): 10,000.00 para Ana y 600,000.00 para los demás.
4. 60,000 transferencias completadas (120,000 asientos), todas con un lado en "Principal" de Ana, más 12 depósitos de nómina de la Tesorería, repartidas en los 12 meses que terminan **ayer a las 23:59 de CDMX**: nada cae en el día actual, así que el límite diario de hoy está libre. Se generan por tandas de 5,000 con `generate_series` y el `balance_after` se calcula en staging con una función de ventana.
5. Ajuste de cada saldo al `balance_after` de su último asiento, `ANALYZE` y verificación de invariantes: mínimo de 100,000 asientos, suma global cero, ningún `balance_after` negativo en cuentas USER, cadena de `balance_after` correcta, saldos iguales al último asiento, Tesorería igual al negativo de las cuentas USER y ningún movimiento de hoy. Si algo falla, el comando termina con código 1.

Tiempo medido en local (PostgreSQL 16 en Docker, 2026-10-13): **10.7 s** la primera vez (120,128 asientos, 60,013 en "Principal" de Ana) y 0.5 s las siguientes. Los planes de las consultas del historial con este volumen están en `openspec/changes/api-ledger/design.md` (sección "EXPLAIN ANALYZE").

`db:fund` es la única forma de meter dinero (no hay endpoint que lo cree): valida el monto con las mismas reglas que la API antes de conectarse, usa el rol de la aplicación y registra `FUNDING_POSTED` con actor SYSTEM.

## Conciliación del ledger

Las mismas consultas que usan las pruebas (`test/helpers/reconciliation.ts`) y la verificación del seed; con `psql` como `wallet_migrator` sobre el esquema `app`:

```sql
-- 1. Saldo = suma de asientos, por cuenta (debe devolver 0 filas)
SELECT a.id FROM accounts a
LEFT JOIN ledger_entries e ON e.account_id = a.id
GROUP BY a.id, a.balance_cents
HAVING a.balance_cents <> COALESCE(SUM(e.amount_cents), 0);

-- 2. Suma global de asientos (debe ser 0)
SELECT COALESCE(SUM(amount_cents), 0) FROM ledger_entries;

-- 3. Cadena de balance_after (debe devolver 0 filas)
SELECT * FROM (
  SELECT id, account_id, balance_after_cents,
         SUM(amount_cents) OVER (PARTITION BY account_id ORDER BY created_at, id) AS running
    FROM ledger_entries) t
WHERE balance_after_cents <> running;

-- 4. Tesorería = negativo de la suma de las cuentas USER (debe ser 0)
SELECT (SELECT balance_cents FROM accounts WHERE type = 'SYSTEM')
     + (SELECT COALESCE(SUM(balance_cents), 0) FROM accounts WHERE type = 'USER');
```

La base también lo protege por su cuenta: un trigger diferido rechaza al hacer `COMMIT` cualquier transferencia cuyos asientos no sean exactamente dos que sumen cero, y los asientos no se pueden modificar ni borrar (sin `UPDATE`/`DELETE`/`TRUNCATE` para `wallet_app` y un trigger que lo impide incluso al dueño).

## Estado de cuenta

`GET /accounts/{accountId}/statements/{period}` (`getAccountStatement`) devuelve el PDF del mes `period` (`AAAA-MM`, mes calendario de la Ciudad de México) de una cuenta del usuario:

- **Respuesta:** `Content-Type: application/pdf`, `Content-Length`, `Cache-Control: no-store` y `Content-Disposition: attachment; filename="estado-de-cuenta-2026-09-0015.pdf"` (periodo y últimos 4 dígitos de la CLABE).
- **Periodo:** de la medianoche de CDMX del día 1 a la del día 1 del mes siguiente (la conversión a UTC usa la base IANA, así que los meses con horario de verano, antes de 2023, quedan bien). El mes en curso se entrega como parcial, hasta el momento de la generación. Un mes futuro o un periodo mal formado responde `422 VALIDATION_FAILED` en `/period`; una cuenta ajena o inexistente, `404 NOT_FOUND`.
- **Límite:** 10 por minuto por usuario (`429 RATE_LIMITED` con `Retry-After`).
- **Auditoría:** cada descarga registra `STATEMENT_EXPORTED` con el usuario, la cuenta y el periodo, sin CLABE, nombre ni montos. Es la única lectura auditada; si el evento no se puede escribir, la respuesta es 500 y el documento no sale. Los rechazos no dejan evento.

Cómo se arma (`src/modules/statements/`):

1. El lector abre `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`: la cuenta, el titular, el saldo inicial y los movimientos salen de la misma instantánea, así que una transferencia que se completa mientras se genera el documento no aparece y el resumen cuadra.
2. Saldo inicial: el `balance_after` del último asiento anterior al periodo (0 si no hay). Movimientos: tandas ascendentes de 1,000 por keyset, con la misma proyección que el historial (contraparte, concepto, referencia).
3. Mientras pasan las tandas se acumulan abonos y cargos en centavos (`BigInt`); al final se verifica que saldo inicial + abonos − cargos = `balance_after` del último movimiento. Si no cuadra, la API responde 500 con un log ERROR de alerta y el documento no sale.
4. El PDF se genera en memoria con PDFKit (carta, Work Sans incrustada): encabezado con la marca, titular, cuenta, CLABE completa, periodo y hora de generación; recuadro de resumen; tabla con fecha y hora de CDMX, tipo (etiquetas de `@devchrisvaz/wallet-design-tokens`), concepto, contraparte y referencia, cargo y abono en columnas separadas y saldo; encabezados de la tabla en cada página, "Página X de Y" y la leyenda "Documento informativo; no es un comprobante fiscal.". Los montos se escriben con `formatMXN` del contrato.

La tipografía es Work Sans (Regular y SemiBold) del paquete `@fontsource/work-sans`, con licencia SIL Open Font License 1.1 (su `LICENSE` viene en el paquete). Se usa el WOFF del subconjunto latino, que el renderizador convierte una vez a TrueType al arrancar: fontkit no recorta bien el WOFF2 de ese paquete y, con WOFF, descomprimía las tablas en cada consulta (5,000 renglones tardaban 4.3 s solo en el PDF).

Rendimiento medido en local (Node 24, PostgreSQL 16 en Docker, 2026-10-14):

| Caso                                                                          | Movimientos | Tiempo                              | Tamaño              |
| ----------------------------------------------------------------------------- | ----------- | ----------------------------------- | ------------------- |
| Prueba automatizada (`statement-performance.test.ts`, petición HTTP completa) | 5,000       | 0.59 a 0.64 s                       | 409 KB, 162 páginas |
| Seed: septiembre de 2026 de la "Principal" de Ana (lector, resumen y PDF)     | 4,933       | 0.84 a 1.0 s (1.5 s la primera vez) | 620 KB              |

El documento completo vive en memoria mientras se genera (unos 0.6 MB con 5,000 movimientos). Un mes con decenas de miles de movimientos pediría un tope de renglones o una generación asíncrona.

Para comprobar un estado de cuenta contra la base (con `psql` como `wallet_migrator`, esquema `app`), estas cifras en centavos deben coincidir con el resumen del documento:

```sql
-- La cuenta: "Principal" de Ana
SELECT a.id FROM accounts a JOIN users u ON u.id = a.user_id
 WHERE u.email = 'ana@example.com' AND a.name = 'Principal';

-- Resumen de septiembre de 2026 (mes de CDMX); :cuenta es el id anterior
WITH periodo AS (
  SELECT timestamp '2026-09-01 00:00' AT TIME ZONE 'America/Mexico_City' AS inicio,
         timestamp '2026-10-01 00:00' AT TIME ZONE 'America/Mexico_City' AS fin
), mes AS (
  SELECT e.* FROM ledger_entries e, periodo p
   WHERE e.account_id = :'cuenta' AND e.created_at >= p.inicio AND e.created_at < p.fin
)
SELECT
  COALESCE((SELECT e.balance_after_cents FROM ledger_entries e, periodo p
             WHERE e.account_id = :'cuenta' AND e.created_at < p.inicio
             ORDER BY e.created_at DESC, e.id DESC LIMIT 1), 0)              AS saldo_inicial,
  (SELECT COALESCE(SUM(amount_cents), 0) FROM mes WHERE amount_cents > 0)    AS abonos,
  (SELECT COALESCE(-SUM(amount_cents), 0) FROM mes WHERE amount_cents < 0)   AS cargos,
  (SELECT balance_after_cents FROM mes ORDER BY created_at DESC, id DESC LIMIT 1) AS saldo_final,
  (SELECT count(*) FROM mes)                                                  AS movimientos;
```

Para el mes en curso, `fin` es el momento de la generación. Sin movimientos en el mes, `saldo_final` sale nulo y el documento muestra el saldo inicial. Con el seed de la base local (4,933 movimientos en septiembre de 2026) cuadra con el documento.

La migración `1760600000000-audit-statement-exported` agrega `STATEMENT_EXPORTED` al catálogo de la bitácora: una base creada antes necesita `npm run db:migrate`.

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
    beneficiaries/  alta por CLABE de la plataforma y listado
    transfers/  domain (ledger, máquina de estados, huella) · application (creación, OTP, confirmación, fondeo) · infrastructure
    movements/  historial: filtros, cursor firmado y consulta keyset
    statements/ estado de cuenta: periodo y resumen (dominio), caso de uso, lector con instantánea y PDF
  platform/     config, contexto de petición, http (app, errores RFC 9457, validación, auth, rate limit, docs), logging, mail, persistencia
  shared/       núcleo sin dependencias: errores de dominio, Clock, transacción opaca, enmascarado
  seed/         datos de desarrollo (usuarios, beneficiarios, fondeo y volumen)
  composition.ts  raíz de composición con inyección manual
  main.ts         arranque del proceso
migrations/     migraciones TypeORM con SQL explícito (constraints, funciones, triggers y GRANTs)
db/             bootstrap.sql
test/           unit/, integration/, helpers/ (arnés, contrato, reloj falso, correo en memoria), vectors/
```

Reglas (las hace cumplir ESLint): el dominio no importa Express, TypeORM ni adaptadores; la aplicación depende de puertos, no de infraestructura; los handlers HTTP solo validan, llaman al caso de uso y traducen el resultado.
