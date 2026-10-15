# API de la billetera (`/api`)

Backend de la billetera digital en MXN: identidad (registro con verificación por correo, sesiones con refresh rotativo), cuentas con CLABE, beneficiarios, transferencias con ledger de partida doble (idempotencia, límite diario, OTP por correo), transferencias programadas con fecha futura, historial con paginación por cursor, estado de cuenta mensual en PDF y bitácora de auditoría inmutable. Express 5 + TypeScript estricto + PostgreSQL 16 con TypeORM (sin `synchronize`, migraciones con SQL explícito).

El contrato es [`contract/openapi.yaml`](../contract/openapi.yaml) (paquete `@devchrisvaz/wallet-contract`). Especificación: `openspec/changes/api-foundation/` (requisitos PLT, IDN, AUD y ACC-01 a ACC-09) `openspec/changes/api-ledger/` (ACC-10 a ACC-16, BEN, TRF-01 a TRF-26 e HIS-01 a HIS-10), `openspec/changes/account-statements/` (HIS-11, HIS-12 y AUD-07) y `openspec/changes/scheduled-transfers/` (TRF-27 a TRF-36 y AUD-08).

## Requisitos

- **Node.js 24** para desarrollo y pruebas (Vitest 5 pide Node ≥ 22). El build corre en Node ≥ 20.
- **Docker** con Compose (PostgreSQL 16 y Mailpit).
- `psql` es opcional: si no está instalado, `db:bootstrap` usa el de la imagen de PostgreSQL de docker compose, pero solo si `BOOTSTRAP_DATABASE_URL` apunta a ese contenedor (ver abajo).

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

### `db:bootstrap` sin `psql`

Con `psql` instalado, el script se conecta a `BOOTSTRAP_DATABASE_URL`. Sin él ejecuta el SQL dentro del contenedor `postgres` de docker compose, que no mira el host ni el puerto de la URL, y el proyecto de compose se llama `treo-api` en cualquier copia del repositorio. Por eso, desde otra copia (un worktree con su propio `.env` y otro puerto) el script podía reafirmar los roles y las contraseñas en el contenedor de la copia principal.

Ahora lo decide `scripts/bootstrap-plan.ts`, con pruebas unitarias (`test/unit/project/bootstrap-plan.test.ts`): sin `psql` solo ejecuta en el contenedor si el host de la URL es `localhost`, `127.0.0.1` o `::1` y su puerto es uno de los que publica `docker compose port postgres 5432`. En cualquier otro caso termina con código 1 y sin ejecutar nada, con un mensaje que nombra la URL (sin su contraseña) y el puerto que publica compose. Para seguir, instala `psql` o apunta `BOOTSTRAP_DATABASE_URL` a ese puerto. Las contraseñas de los roles siguen llegando por variables de entorno, nunca como argumentos (PLT-14).

### Credenciales demo

| Usuario               | Email                                             | Contraseña           |
| --------------------- | ------------------------------------------------- | -------------------- |
| Ana Gómez Cruz        | `ana@example.com`                                 | `Ana-demo-2026!`     |
| Luis Pérez López      | `luis@example.com`                                | `Luis-demo-2026!`    |
| 50 usuarios generados | `usuario01@example.com` … `usuario50@example.com` | `Demo-usuario-2026!` |

Todos están verificados y tienen sus cuentas "Principal" y "Ahorro"; sus CURP, RFC y teléfonos son sintéticos (válidos en estructura y dígito verificador, no corresponden a personas reales). Ana ya tiene registrado a Luis (alias "Luis") y a otros nueve usuarios como beneficiarios, y su "Principal" tiene unos 60,000 movimientos de los últimos 12 meses. Para probar transferencias desde cero, fondea otra cuenta con `db:fund`.

### Registro manual

`POST /auth/register` responde 202 siempre; el código de 6 dígitos llega a la bandeja de Mailpit y se confirma con `POST /auth/verify-email`, que devuelve la sesión y abre las dos cuentas.

Si la CURP, el RFC o el teléfono ya son de otro usuario, el registro sigue el mismo camino (202 y el mismo correo con código), pero queda **en revisión** (`users.identity_conflict`): al verificar el correo la API responde `403 REGISTRATION_IN_REVIEW` sin abrir cuentas ni sesión, y el dueño de esos datos recibe "Alguien intentó registrarse con tus datos". Iniciar sesión responde lo mismo.

### Registros en revisión

Soporte los resuelve fuera del producto (D6 de `registration-review`). Para listarlos, con `psql` como `wallet_migrator` sobre el esquema `app`:

```sql
SELECT u.id, u.created_at, u.email_verified_at,
       EXISTS (SELECT 1 FROM users o WHERE NOT o.identity_conflict AND o.curp = u.curp) AS curp_taken,
       EXISTS (SELECT 1 FROM users o WHERE NOT o.identity_conflict AND o.rfc = u.rfc) AS rfc_taken,
       EXISTS (SELECT 1 FROM users o WHERE NOT o.identity_conflict AND o.phone = u.phone) AS phone_taken
  FROM users u
 WHERE u.identity_conflict
 ORDER BY u.created_at;
```

### Límites de tasa, caché y avisos

Cada límite responde `429 RATE_LIMITED` con `Retry-After`. El tope de cada uno se cambia con una variable de entorno (entero de 1 a 10000); la ventana es fija.

| Ruta                              | Llave   | Ventana | Tope por defecto | Variable                          |
| --------------------------------- | ------- | ------- | ---------------- | --------------------------------- |
| `POST /auth/refresh`              | IP      | 15 min  | 120              | `RATE_LIMIT_REFRESH_MAX`          |
| `POST /auth/logout`               | IP      | 15 min  | 60               | `RATE_LIMIT_LOGOUT_MAX`           |
| `POST /transfers`                 | usuario | 10 min  | 30               | `RATE_LIMIT_TRANSFER_CREATE_MAX`  |
| `POST /transfers/{id}/confirm`    | usuario | 15 min  | 15               | `RATE_LIMIT_TRANSFER_CONFIRM_MAX` |
| `POST /transfers/{id}/otp/resend` | usuario | 15 min  | 6                | `RATE_LIMIT_TRANSFER_RESEND_MAX`  |
| `POST /transfers/{id}/cancel`     | usuario | 10 min  | 20               | `RATE_LIMIT_TRANSFER_CANCEL_MAX`  |

- **Qué cuenta:** toda petición que llega al límite, también la rechazada por validación y la repetición de una `Idempotency-Key`. Una petición sin access token no gasta el cupo de nadie. Los topes dejan espacio a los cinco reintentos de la app (seis peticiones con la misma llave).
- **IP compartida:** `refresh` y `logout` cuentan por la IP que resuelve `TRUSTED_PROXIES`. Si el BFF no está en esa lista, todas las personas de la web comparten una llave.
- **En las pruebas:** `testConfig` sube los cuatro topes de transferencias a 10000 para que las suites de concurrencia (~100 transferencias de un usuario) afirmen lo suyo; cada prueba de un límite pasa el suyo.
- **Sin caché:** toda respuesta lleva `Cache-Control: no-store`, también los problem+json, los 404, los 429 y `GET /health`. `/docs` y `/openapi.yaml` (fuera de producción) quedan fuera.
- **Avisos por correo:** salen después del `COMMIT` por un `NoticeDispatcher` que no hace esperar la respuesta. Cada envío tiene su propio `catch`, y una falla solo queda en el log con el destinatario enmascarado. En el apagado ordenado, `drain()` espera hasta 5 s los que van en vuelo.

| Aviso                                   | Sale cuando                                                                                    | No sale cuando                                                                                                            |
| --------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| "Iniciaste sesión en TreoWallet"        | `POST /auth/login` responde `200`                                                              | `401`, `403`, `429`, `refresh`, verificación del correo                                                                   |
| "Cerramos una sesión por seguridad"     | Un refresh token ya usado revoca su familia                                                    | Token desconocido o vencido, reintento dentro de la ventana de gracia, la misma familia otra vez                          |
| "Agregaste a <alias> como beneficiario" | `POST /beneficiaries` responde `201`                                                           | La repetición idéntica (`200`), `409`, `422`                                                                              |
| "Transferencia realizada"               | Una transferencia a un tercero llega a `COMPLETED` (al crear, al confirmar, o por el ejecutor) | Repetición de la llave, confirmación repetida, traspaso entre cuentas propias, fondeo (seed y `db:fund`), el destinatario |

El aviso de inicio de sesión describe al cliente con el `User-Agent` (`client-description.ts`): la app dice `TreoWallet-App/<versión> (<ios|android>)`, un navegador se reconoce por su marca y su sistema ("Chrome en Windows"), y todo lo demás es "un dispositivo". La IP sale con el último octeto oculto (`203.0.113.*`). Ningún aviso lleva la CLABE completa, contraseñas, tokens ni códigos.

## Scripts

| Script                                  | Qué hace                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dev`                                   | API con recarga (tsx) leyendo `.env`                                                                                                                                                                                                                                                                                                |
| `build` / `start`                       | Compila a `dist/` y lo ejecuta con Node                                                                                                                                                                                                                                                                                             |
| `db:bootstrap`                          | `db/bootstrap.sql` con psql como superusuario (`BOOTSTRAP_DATABASE_URL`): roles `wallet_migrator` y `wallet_app`, bases `wallet` y `wallet_test`, esquema `app`. Las contraseñas de los roles llegan por variables de entorno. Sin `psql` solo usa el contenedor de compose si la URL apunta a él (ver "`db:bootstrap` sin `psql`") |
| `db:migrate`                            | Aplica migraciones pendientes con el rol dueño (`MIGRATION_DATABASE_URL`)                                                                                                                                                                                                                                                           |
| `db:revert`                             | Revierte la última migración; `npm run db:revert -- --all` revierte todas                                                                                                                                                                                                                                                           |
| `db:seed`                               | Datos de desarrollo con volumen (ver abajo). Idempotente y termina verificando las invariantes del ledger                                                                                                                                                                                                                           |
| `db:fund`                               | Fondea una cuenta desde la Tesorería: `npm run db:fund -- --account <id o CLABE> --amount 1000.00`                                                                                                                                                                                                                                  |
| `lint`, `typecheck`, `format:check`     | ESLint (incluye la regla de capas), TypeScript, Prettier                                                                                                                                                                                                                                                                            |
| `test`, `test:unit`, `test:integration` | Vitest                                                                                                                                                                                                                                                                                                                              |

## Datos de desarrollo (`db:seed`)

`npm run db:seed` usa el rol dueño (`MIGRATION_DATABASE_URL`) y es idempotente: correrlo otra vez no duplica nada. Crea:

1. Ana, Luis y 50 usuarios generados, verificados, con sus dos cuentas.
2. Beneficiarios: Luis y otros nueve para Ana; "Ana" para cada uno de los demás.
3. Fondeo inicial de cada "Principal" desde la Tesorería con el mismo servicio que `db:fund` (evento `FUNDING_POSTED`): 10,000.00 para Ana y 600,000.00 para los demás.
4. 60,000 transferencias completadas (120,000 asientos), todas con un lado en "Principal" de Ana, más 12 depósitos de nómina de la Tesorería, repartidas en los 12 meses que terminan **ayer a las 23:59 de CDMX**: nada cae en el día actual, así que el límite diario de hoy está libre. Se generan por tandas de 5,000 con `generate_series` y el `balance_after` se calcula en staging con una función de ventana.
5. Ajuste de cada saldo al `balance_after` de su último asiento, `ANALYZE` y verificación de invariantes: mínimo de 100,000 asientos, suma global cero, ningún `balance_after` negativo en cuentas USER, cadena de `balance_after` correcta, saldos iguales al último asiento, Tesorería igual al negativo de las cuentas USER y ningún movimiento de hoy. Si algo falla, el comando termina con código 1.

Tiempo medido en local (PostgreSQL 16 en Docker, 2026-10-13): **10.7 s** la primera vez (120,128 asientos, 60,013 en "Principal" de Ana) y 0.5 s las siguientes. Los planes de las consultas del historial con este volumen están en `openspec/changes/archive/2026-10-14-api-ledger/design.md` (sección "EXPLAIN ANALYZE").

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
- **Periodo:** de la medianoche de CDMX del día 1 a la del día 1 del mes siguiente (la conversión a UTC usa la base IANA, así que los meses con horario de verano, antes de 2023, quedan bien). El mes en curso se entrega como parcial, hasta el momento de la generación. Un mes futuro, un mes anterior al de apertura de la cuenta (medido en CDMX, con `isPeriodBeforeCreation` del contrato) o un periodo mal formado responde `422 VALIDATION_FAILED` en `/period` (`DATE_OUT_OF_RANGE` en los dos primeros); una cuenta ajena o inexistente, `404 NOT_FOUND`.
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

## Transferencias programadas

`POST /transfers` con `scheduledFor` (instante RFC 3339 con desfase, por ejemplo `2026-10-20T14:30:00-06:00`, con minutos exactos; de 10 minutos a 90 días después de ahora) programa la transferencia en lugar de ejecutarla:

- **Hasta 10,000.00:** `201` con estado `SCHEDULED`, sin asientos y sin tocar saldo ni límite. **Arriba de 10,000.00:** `201` en `PENDING_OTP`, con la fecha en el correo del código ("Programada para el 20 de octubre de 2026, 14:30 (hora de la Ciudad de México)."); al confirmar el código queda `SCHEDULED`, también sin mover dinero ni revalidar.
- **Validación al programar:** el instante (`422 VALIDATION_FAILED` en `/scheduledFor` con `DATE_OUT_OF_RANGE` si queda fuera de la ventana, o `INVALID_FORMAT` si no es RFC 3339 con desfase, no existe o trae segundos), las mismas reglas de propiedad, monto, concepto y referencia que una inmediata, y que una programada a un tercero no supere el límite diario (`TOO_LARGE` en `/amount`: nunca podría ejecutarse). El saldo y el límite **de hoy** no se validan: se validan al ejecutar.
- **Idempotencia:** la fecha forma parte del contenido que se compara (`IDEMPOTENCY_KEY_REUSED` con otra fecha), pero entra en la huella **solo cuando existe** (como instante ISO UTC, así que `...-06:00` y `...Z` equivalentes dan la misma huella): la huella de las inmediatas ya guardadas no cambió. La fecha y el monto se validan después de reclamar la llave: un reintento que llega pasada la medianoche se reconoce como reintento en lugar de responder que su fecha ya no es programable, y una petición nueva inválida revierte el reclamo, así que no consume la llave.
- **Tope:** 20 activas por usuario (las `SCHEDULED` y las programadas en `PENDING_OTP` vigentes). La número 21 responde `422 SCHEDULED_LIMIT_REACHED` sin guardarse ni consumir la llave.
- **Consultar y cancelar:** `GET /transfers/scheduled` (`listScheduledTransfers`) devuelve las `SCHEDULED` del usuario por fecha y luego por creación. `POST /transfers/{transferId}/cancel` (`cancelTransfer`) pasa una `SCHEDULED` a `CANCELLED` con `cancelledAt`; cancelarla otra vez responde `200` sin cambios y cualquier otro estado, `409 TRANSFER_NOT_CANCELLABLE` con `transferStatus`.
- Hasta ejecutarse, una programada no aparece en el historial ni consume límite. `GET /transfers/{transferId}` muestra `scheduledFor` en cualquier estado y `cancelledAt` en las canceladas.
- **Auditoría:** `TRANSFER_CREATED` (con el estado inicial y la fecha), `TRANSFER_SCHEDULED` al quedar programada (al crearla o al confirmar su código) y `TRANSFER_CANCELLED` con actor `USER`; la ejecución deja `TRANSFER_COMPLETED` o `TRANSFER_FAILED` con actor `SYSTEM` y el id del dueño en los metadatos.

### El ejecutor

`ScheduledTransferRunner` (`src/modules/transfers/application/scheduled-transfer-runner.ts`) corre dentro de la API. `main.ts` lo programa con una pasada al arrancar y luego una por intervalo, **una a la vez por instancia** (si una pasada sigue en curso, la siguiente se omite):

| Variable                | Valor por defecto | Qué controla                                                                                   |
| ----------------------- | ----------------- | ---------------------------------------------------------------------------------------------- |
| `SCHEDULER_ENABLED`     | `true`            | `false` lo apaga (las pruebas llaman a `runOnce()` directamente)                               |
| `SCHEDULER_INTERVAL_MS` | `60000`           | Cada cuánto corre una pasada; de 1,000 a 3,600,000                                             |
| `SCHEDULER_BATCH_SIZE`  | `100`             | Candidatas por lote (1 a 1,000); si un lote viene lleno, la pasada sigue con el siguiente lote |

Una pasada lee sin bloqueo las `SCHEDULED` con `scheduled_for` menor o igual al instante actual, en orden de instante y creación (índice parcial `ix_transfers_scheduled_due`), y ejecuta cada una en su propia transacción:

1. Si es a un tercero, crea y bloquea la fila contador del límite del usuario para el día de ahora.
2. Bloquea la transferencia con `SELECT … WHERE id = $1 AND status = 'SCHEDULED' FOR NO KEY UPDATE SKIP LOCKED`. Sin fila: otra instancia o una cancelación la tiene, o ya cambió de estado; se deja y se sigue.
3. Bloquea las cuentas en orden de id; toma la hora después de los bloqueos y, si ya cambió el día de la Ciudad de México, revierte y reintenta una vez (el mismo mecanismo que una inmediata).
4. Valida saldo y límite **del día de ejecución** con el mismo servicio que la creación inmediata (`LockedTransferExecutor`) y la deja `COMPLETED` (dos asientos, `completedAt` = hora de ejecución, límite de ese día) o `FAILED` con `INSUFFICIENT_FUNDS` o `DAILY_LIMIT_EXCEEDED`.
5. Después del `COMMIT`, si quedó `FAILED`, envía al dueño "Tu transferencia programada no se realizó" (monto, destino con los últimos 4 dígitos de la CLABE, fecha y motivo). Si el correo falla, queda un WARN con el `transferId`; la transferencia sigue `FAILED` y no se repite.

Una programada vencida mientras la API no corría se ejecuta en la siguiente pasada y consume el límite del día en que se ejecuta. Si algo lanza dentro de la transacción de una transferencia (por ejemplo, la auditoría), solo esa se revierte: queda un ERROR con su id, la pasada sigue con las demás y esa transferencia se reintenta en la siguiente pasada. Con `SIGTERM` el proceso deja de aceptar peticiones, detiene el ejecutor, espera la pasada en curso y solo entonces cierra el pool.

### Concurrencia

Cada programada se ejecuta exactamente una vez aunque corran varias instancias de la API (en AWS, una por tarea de Fargate; todas corren el ejecutor):

- **Orden global de bloqueos**, el mismo de las inmediatas: contador del usuario → transferencia → cuentas por id. Nadie toma un bloqueo "hacia atrás", así que no hay ciclos de espera.
- **`SKIP LOCKED`** sobre la transferencia: dos ejecutores no se esperan entre sí; se reparten el trabajo sin coordinarse.
- **Estado re-verificado bajo bloqueo:** con `READ COMMITTED`, PostgreSQL vuelve a evaluar `status = 'SCHEDULED'` sobre la versión vigente de la fila, así que lo que otra instancia ya ejecutó o el usuario canceló se descarta. La base es la red: un segundo par de asientos choca con `uq_ledger_entries_transfer_account` y ejecutar una cancelada, con `ck_transfers_cancelled_at_by_status`.
- **Cancelación contra ejecución:** la cancelación bloquea solo la transferencia. Si el ejecutor la tiene, la cancelación espera y responde `409` con `COMPLETED` o `FAILED`; si la tiene la cancelación, el ejecutor la salta y en la siguiente pasada ya no está `SCHEDULED`. Gana exactamente una.
- **Tope por usuario:** programar bloquea la fila del usuario (`FOR NO KEY UPDATE`, que no choca con el `FOR KEY SHARE` de las llaves foráneas), así que dos programaciones simultáneas hacen fila y la segunda cuenta a la primera.

Lo demuestran las pruebas de `test/integration/concurrency/` (`scheduled-runners`, `cancel-race`, `scheduled-cap-race`): dos ejecutores sobre 50 vencidas con conciliación, el ejecutor contra transferencias manuales de la misma cuenta, las tres variantes de la carrera con la cancelación (con barreras dentro de las transacciones) y el tope con dos peticiones simultáneas. Como alternativa en AWS queda EventBridge Scheduler invocando `runOnce` cada minuto en una tarea aparte.

Las migraciones `1760800000000-optional-transfer-reference` (`reference` admite `NULL`; los fondeos pasan a `NULL`) y `1760800001000-scheduled-for-instant` (`scheduled_for` de `date` a `timestamptz`; las filas existentes quedan a las 09:00 de America/Mexico_City de su día) se aplican igual con `npm run db:migrate`; su `down` pierde la hora y la distinción entre referencia 0 y ninguna. Las migraciones `1760700000000-scheduled-transfers` (columnas, estados, constraints e índices parciales) y `1760700001000-audit-scheduled-transfers` (catálogo de la bitácora) necesitan `npm run db:migrate` en una base creada antes. El `down` de la primera se niega mientras exista alguna transferencia programada (pendiente, ejecutada o cancelada), para no borrar sus fechas.

### Verlas ejecutarse en local

Una programada vence en su minuto exacto y el ejecutor corre cada 60 s por omisión (`SCHEDULER_INTERVAL_MS=60000`), así que se ejecuta como mucho un minuto después. Para no esperar, se adelanta su instante en la base:

```bash
# 1. Pasadas cada 5 s: en .env, SCHEDULER_INTERVAL_MS=5000; después `npm run dev`.

# 2. Sesión de Ana y los ids de su "Principal" y de su beneficiario Luis
TOKEN=$(curl -s localhost:4000/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"ana@example.com","password":"Ana-demo-2026!"}' | jq -r .tokens.accessToken)
FROM=$(curl -s localhost:4000/accounts -H "Authorization: Bearer $TOKEN" \
  | jq -r '.accounts[] | select(.name == "Principal") | .id')
LUIS=$(curl -s localhost:4000/beneficiaries -H "Authorization: Bearer $TOKEN" \
  | jq -r '.items[] | select(.alias == "Luis") | .id')

# 3. Programar 100.00 para dentro de una hora (minutos exactos, con desfase)
TOMORROW=$(date -d '+1 hour' +%Y-%m-%dT%H:%M:00%:z)
ID=$(curl -s localhost:4000/transfers -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" -H 'Content-Type: application/json' \
  -d "{\"fromAccountId\":\"$FROM\",\"destination\":{\"type\":\"BENEFICIARY\",\"beneficiaryId\":\"$LUIS\"},\"amount\":\"100.00\",\"concept\":\"Prueba programada\",\"reference\":\"1\",\"scheduledFor\":\"$TOMORROW\"}" \
  | jq -r .id)
curl -s localhost:4000/transfers/scheduled -H "Authorization: Bearer $TOKEN" | jq '.items[] | {id, status, scheduledFor}'

# 4. "Llega" su hora: solo en desarrollo, con el rol dueño
docker compose exec -T postgres psql -U wallet_migrator -d wallet -c \
  "UPDATE app.transfers SET scheduled_for = date_trunc('minute', now())
    WHERE id = '$ID' AND status = 'SCHEDULED'"

# 5. En menos de 5 s el log de la API muestra "scheduled transfers pass" con completed: 1
curl -s localhost:4000/transfers/$ID -H "Authorization: Bearer $TOKEN" | jq '{status, scheduledFor, completedAt}'
```

Para ver una falla, programa un monto mayor al saldo de la cuenta: queda `FAILED` con `INSUFFICIENT_FUNDS` y el aviso llega a Mailpit (http://localhost:8025). En la base, los asientos y la auditoría de la ejecución (las consultas de conciliación de arriba deben seguir en cero):

```bash
docker compose exec -T postgres psql -U wallet_migrator -d wallet -c \
  "SELECT type, amount_cents, created_at FROM app.ledger_entries WHERE transfer_id = '$ID'"
docker compose exec -T postgres psql -U wallet_migrator -d wallet -c \
  "SELECT action, actor_type, actor_user_id, metadata FROM app.audit_log WHERE entity_id = '$ID' ORDER BY id"
```

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
    transfers/  domain (ledger, máquina de estados, huella, rango programable, regla de saldo y límite) · application (creación, OTP, confirmación, programadas: ejecutor, cancelación y lista; fondeo) · infrastructure
    movements/  historial: filtros, cursor firmado y consulta keyset
    statements/ estado de cuenta: periodo y resumen (dominio), caso de uso, lector con instantánea y PDF
  platform/     config, contexto de petición, http (app, errores RFC 9457, validación, auth, rate limit, docs), logging, mail, persistencia, trabajo periódico y apagado ordenado
  shared/       núcleo sin dependencias: errores de dominio, Clock, transacción opaca, enmascarado
  seed/         datos de desarrollo (usuarios, beneficiarios, fondeo y volumen)
  composition.ts  raíz de composición con inyección manual
  main.ts         arranque del proceso, ejecutor de programadas y apagado ordenado
migrations/     migraciones TypeORM con SQL explícito (constraints, funciones, triggers y GRANTs)
db/             bootstrap.sql
test/           unit/, integration/, helpers/ (arnés, contrato, reloj falso, correo en memoria), vectors/
```

Reglas (las hace cumplir ESLint): el dominio no importa Express, TypeORM ni adaptadores; la aplicación depende de puertos, no de infraestructura; los handlers HTTP solo validan, llaman al caso de uso y traducen el resultado.
