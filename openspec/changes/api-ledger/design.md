## Context

Ver `proposal.md` (Why). Este diseño parte de lo que entrega `api-foundation` y lo trata como existente:

- Capas de dominio, aplicación e infraestructura; los handlers de Express solo traducen HTTP.
- Errores RFC 9457 con `code` y `requestId`, y traducción de errores de PostgreSQL **por nombre de constraint** (PLT-01, PLT-04).
- Puertos `Clock` (inyectable en pruebas), `Mailer` (SMTP, Mailpit en local) y escritor de auditoría que recibe la transacción en curso (AUD-03).
- Rate limiting en memoria (PLT-09), configuración validada al arrancar (PLT-08), roles `wallet_migrator` y `wallet_app` con grants explícitos por migración (PLT-14).
- Tablas `users`, `refresh_tokens`, `one_time_codes` (propósitos `EMAIL_VERIFICATION` y `TRANSFER_CONFIRMATION`, código guardado como hash), `audit_log` y `accounts` (tipo `USER`/`SYSTEM`, CLABE generada, saldo en centavos con `CHECK` de no negativo para `USER`), y la función SQL `clabe_is_valid(text)`.
- Arnés de pruebas con dos conexiones (migrador para reiniciar, app para el código) y validación con Ajv de cada respuesta contra `contract/openapi.yaml`.

**Supuestos de nombres** que este change usa y que `api-foundation` debe respetar o este diseño ajustar al aplicar: `accounts.balance_cents BIGINT`, constraint `ck_accounts_balance_non_negative`, `accounts.type` en (`USER`, `SYSTEM`), función `clabe_is_valid(text)`.

Operaciones del contrato que implementa este change: `listAccounts`, `getAccount`, `listAccountMovements`, `listBeneficiaries`, `createBeneficiary`, `createTransfer`, `getTransfer`, `confirmTransfer`, `resendTransferOtp`.

## Goals / Non-Goals

**Goals:**
- Que la integridad del dinero dependa de la base de datos y no solo del código: `CHECK`, llaves únicas, trigger de suma cero, asientos inmutables y fila contador del límite.
- Concurrencia determinista y sin deadlocks, demostrada con 100 transferencias simultáneas.
- Idempotencia que resista doble clic, reintentos tras pérdida de red y peticiones simultáneas.
- Historial con rendimiento estable con más de 100k movimientos, demostrado con `EXPLAIN ANALYZE`.

**Non-Goals:**
- Retención de fondos durante el OTP, ventana móvil de 24 horas para el límite, tabla genérica `idempotency_keys`, patrón outbox para correos, comisiones y su política de redondeo, SPEI hacia otros bancos, endpoint de depósito. Quedan en "qué haría con más tiempo".
- Cambiar el contrato: este change lo implementa tal cual.

## Decisions

### 1. Modelo de datos completo

El diagrama muestra todas las tablas del sistema. Las marcadas como *(foundation)* las crea `api-foundation`; este change agrega `beneficiaries`, `transfers`, `ledger_entries` y `daily_transfer_usage`.

```mermaid
erDiagram
    users ||--o{ accounts : "es dueño de (USER)"
    users ||--o{ refresh_tokens : "tiene sesiones"
    users ||--o{ beneficiaries : "registra"
    users ||--o{ transfers : "inicia"
    users ||--o{ daily_transfer_usage : "consume límite"
    accounts ||--o{ beneficiaries : "es apuntada por"
    accounts ||--o{ transfers : "origen"
    accounts ||--o{ transfers : "destino"
    accounts ||--o{ ledger_entries : "registra"
    beneficiaries |o--o{ transfers : "destino a tercero"
    transfers ||--o{ ledger_entries : "genera 0 o 2"

    users {
        uuid id PK "(foundation)"
        citext email UK
        text password_hash
        text full_name
        char18 curp UK
        char13 rfc UK
        text phone_e164 UK
        timestamptz email_verified_at
    }
    refresh_tokens {
        uuid id PK "(foundation)"
        uuid user_id FK
        uuid family_id
        text token_hash UK
    }
    one_time_codes {
        uuid id PK "(foundation)"
        text purpose "EMAIL_VERIFICATION | TRANSFER_CONFIRMATION"
        uuid subject_id "usuario o transferencia"
        text code_hash
        int attempts
        int resend_count
        timestamptz expires_at
        timestamptz consumed_at
    }
    accounts {
        uuid id PK "(foundation)"
        uuid user_id FK "NULL solo en SYSTEM"
        text type "USER | SYSTEM"
        text name "Principal | Ahorro | Tesorería"
        char18 clabe UK "NULL solo en SYSTEM"
        bigint balance_cents "CHECK >= 0 si USER"
    }
    beneficiaries {
        uuid id PK
        uuid user_id FK
        uuid account_id FK "cuenta resuelta por la CLABE"
        varchar100 name
        varchar30 alias
        char18 clabe "CHECK clabe_is_valid"
        timestamptz created_at
    }
    transfers {
        uuid id PK
        uuid user_id FK "NULL en FUNDING"
        uuid idempotency_key "NULL en FUNDING"
        char64 request_fingerprint
        text kind "FUNDING | OWN | THIRD_PARTY"
        text status "PENDING_OTP | COMPLETED | REJECTED | FAILED"
        uuid from_account_id FK
        uuid to_account_id FK
        uuid beneficiary_id FK "solo THIRD_PARTY"
        bigint amount_cents "CHECK > 0"
        varchar40 concept
        int reference "0..9999999"
        bool requires_otp
        text rejection_reason
        text failure_reason
        timestamptz otp_expires_at
        timestamptz created_at
        timestamptz completed_at
    }
    ledger_entries {
        bigint id PK "identity"
        uuid transfer_id FK
        uuid account_id FK
        text type "DEPOSIT | TRANSFER_IN | TRANSFER_OUT | OWN_TRANSFER_IN | OWN_TRANSFER_OUT"
        bigint amount_cents "con signo, distinto de 0"
        bigint balance_after_cents
        timestamptz created_at "= transfers.completed_at"
    }
    daily_transfer_usage {
        uuid user_id PK,FK
        date day PK "día de America/Mexico_City"
        bigint used_cents
        bigint limit_cents "CHECK used <= limit"
    }
    audit_log {
        bigint id PK "(foundation) sin FKs"
        text actor_type
        uuid actor_user_id
        text action
        text entity_type
        text entity_id
        jsonb metadata
        timestamptz occurred_at
    }
```

**Constraints nuevas (todas con nombre, para traducir errores por nombre):**

| Tabla | Constraint | Regla |
|---|---|---|
| `beneficiaries` | `uq_beneficiaries_user_clabe` | `UNIQUE (user_id, clabe)` |
| | `uq_beneficiaries_user_alias` | `UNIQUE (user_id, alias)` |
| | `ck_beneficiaries_clabe_valid` | `CHECK (clabe_is_valid(clabe))` |
| | `ck_beneficiaries_alias_trimmed`, `ck_beneficiaries_name_length` | longitud y sin espacios en los extremos |
| `transfers` | `uq_transfers_user_idempotency_key` | `UNIQUE (user_id, idempotency_key)` |
| | `ck_transfers_amount_positive` | `amount_cents > 0` |
| | `ck_transfers_distinct_accounts` | `from_account_id <> to_account_id` |
| | `ck_transfers_reference_range` | `reference BETWEEN 0 AND 9999999` |
| | `ck_transfers_concept_trimmed` | `length(concept) BETWEEN 1 AND 40 AND concept = btrim(concept)` |
| | `ck_transfers_user_key_by_kind` | `kind = 'FUNDING'` o (`user_id` y `idempotency_key` no nulos) |
| | `ck_transfers_beneficiary_by_kind` | `(kind = 'THIRD_PARTY') = (beneficiary_id IS NOT NULL)` |
| | `ck_transfers_reason_by_status` | `rejection_reason` solo en `REJECTED`, `failure_reason` solo en `FAILED` |
| | `ck_transfers_completed_at_by_status` | `(status = 'COMPLETED') = (completed_at IS NOT NULL)` |
| `ledger_entries` | `uq_ledger_entries_transfer_account` | `UNIQUE (transfer_id, account_id)` |
| | `ck_ledger_entries_amount_nonzero` | `amount_cents <> 0` |
| | `ck_ledger_entries_type` | uno de los 5 tipos |
| `daily_transfer_usage` | `pk_daily_transfer_usage` | `PRIMARY KEY (user_id, day)` |
| | `ck_daily_transfer_usage_within_limit` | `used_cents <= limit_cents` |
| | `ck_daily_transfer_usage_non_negative` | `used_cents >= 0` |

`EXPIRED` no se guarda: es `PENDING_OTP` con `otp_expires_at < now`, calculado al leer (decisión #3 de la exploración: sin dinero retenido, la expiración no tiene efectos y no necesita un job).

### 2. Concurrencia: `SELECT … FOR UPDATE` en orden determinista

**Decisión:** transacciones `READ COMMITTED` con bloqueos explícitos en un orden global único:

```
fila de daily_transfer_usage del usuario (solo THIRD_PARTY)
  → fila de la transferencia (solo al confirmar)
    → cuentas involucradas, ORDER BY id
```

- La propiedad se verifica **en la misma sentencia** que bloquea, para que no haya un hueco entre verificar y usar:
  `SELECT id, user_id, type, balance_cents FROM accounts WHERE id = ANY($ids) AND (… propiedad …) ORDER BY id FOR NO KEY UPDATE`. Si devuelve menos filas de las esperadas, la respuesta es 404. Antes de abrir la transacción se resuelve el destino (beneficiario del usuario → su `account_id`; cuenta propia) para responder 404 sin consumir la llave; la sentencia de bloqueo vuelve a filtrar por propiedad como defensa.
- **`FOR NO KEY UPDATE` y no `FOR UPDATE`:** insertar en `transfers` y en `ledger_entries` toma `FOR KEY SHARE` sobre las cuentas referenciadas por sus llaves foráneas. `FOR UPDATE` choca con `FOR KEY SHARE`, así que una transacción que ya insertó su transferencia (y tiene `KEY SHARE` sobre la cuenta A) y espera el contador podría bloquear a otra que tiene el contador y pide `FOR UPDATE` sobre A: un deadlock. `FOR NO KEY UPDATE` no choca con `FOR KEY SHARE`, pero sí entre sí, que es exactamente lo que se necesita para serializar las actualizaciones de saldo (columna que no es llave). Por la misma razón la fila de la transferencia se bloquea con `FOR NO KEY UPDATE` al confirmar.
- El límite y el saldo se leen **bajo bloqueo**; las validaciones del servicio son la regla y los `CHECK` son la red.

**Hora de la operación y día del límite.** La fila contador se identifica por `(user_id, day)`, así que el día se necesita antes de tomar el primer bloqueo, pero la hora que cuenta (`completed_at`) debe tomarse después de obtener todos los bloqueos (la `now()` de PostgreSQL es la hora de inicio de la transacción). Se resuelve así:
1. `t0 = clock.now()`, `day0 = díaCDMX(t0)`; se bloquea la fila `(user, day0)`.
2. Se bloquean transferencia y cuentas.
3. `t1 = clock.now()`; si `díaCDMX(t1) ≠ day0` (cruzó la medianoche mientras esperaba), se hace `ROLLBACK` y la operación se reintenta una vez desde el paso 1. Si no, `t1` es `completed_at` y el día es `day0`.

El reintento solo ocurre si la espera por bloqueos cruza la medianoche, y se prueba inyectando un `Clock` que devuelve 23:59:59.900 y luego 00:00:00.100.

**Alternativas descartadas:**
- **`SERIALIZABLE` con reintentos:** con 100 transferencias simultáneas desde la misma cuenta casi todas fallarían por serialización (`40001`) y el resultado dependería del número de reintentos configurado. `FOR UPDATE` las pone en fila y el resultado es predecible.
- **Bloquear el contador al final** (cuentas → contador → hora): evita el reintento de medianoche, pero las transferencias del mismo usuario retendrían sus bloqueos de cuenta mientras esperan el contador, bloqueando de paso las transferencias entrantes de otros usuarios hacia esas cuentas. Con el contador primero, las operaciones del mismo usuario hacen fila **antes** de tocar cuentas. Además se conserva el orden acordado en la exploración.
- **Bloqueo optimista con versión:** obligaría a reintentar en el caso normal de contención, justo el caso de la prueba de 100.

**Por qué no hay deadlocks:** cada transacción bloquea a lo más una fila contador (la de su usuario) y siempre antes que cualquier cuenta; las cuentas siempre en orden de `id`; la fila de transferencia solo la bloquea la confirmación y siempre antes de las cuentas. No existe un ciclo posible de espera. Un `40P01` se traduce a 500 con alerta porque indicaría un error de diseño.

### 3. Idempotencia de `createTransfer`

**Decisión:** la llave es una columna de `transfers` con `uq_transfers_user_idempotency_key` (la transferencia **es** el registro de idempotencia). El primer paso de la transacción reclama la llave:

```sql
INSERT INTO transfers (id, user_id, idempotency_key, request_fingerprint, status, …)
VALUES (…, 'PENDING_OTP' /* provisional, se corrige en la misma transacción */, …)
ON CONFLICT ON CONSTRAINT uq_transfers_user_idempotency_key DO NOTHING
RETURNING id;
```

- Si devuelve fila: es la primera petición y sigue el flujo normal; el estado definitivo se fija antes del `COMMIT`, así que nadie ve el provisional.
- Si no devuelve fila: hay conflicto. Si otra transacción con la misma llave está en curso, PostgreSQL **espera** a que termine en el índice único; después se lee la transferencia existente (visible en una sentencia nueva bajo `READ COMMITTED`) y se compara el fingerprint:
  - igual → `200` con el estado **actual** y `Idempotent-Replayed: true`, o el mismo `422` si es `REJECTED` o `FAILED` por negocio;
  - distinto → `422 IDEMPOTENCY_KEY_REUSED`.
- **Fingerprint:** SHA-256 hexadecimal de una serialización canónica de los valores **ya interpretados**: `fromAccountId | destination.type | id del destino | amount_cents | concept | reference`. Así `"100.5"` y `"100.50"` producen el mismo fingerprint.
- Las validaciones de esquema (Zod) y la resolución del destino ocurren **antes** de abrir la transacción: un `400`, `404` o `422 VALIDATION_FAILED` nunca consume la llave. Si la propiedad falla ya dentro de la transacción, se hace `ROLLBACK` y tampoco se consume.
- Los rechazos de negocio se guardan como `REJECTED` con su motivo en la misma transacción del reclamo, sin asientos y sin tocar el contador.

**Alternativas descartadas:** tabla genérica `idempotency_keys` con la respuesta serializada (más general, pero obliga a manejar peticiones "en curso", TTL y purga; queda como seguimiento documentado); verificar la llave con un `SELECT` previo (carrera entre la lectura y la inserción); no guardar los rechazos (la misma llave daría dos resultados distintos si entra dinero entre intentos).

### 4. Flujo de creación y confirmación

```mermaid
sequenceDiagram
    autonumber
    participant C as Cliente
    participant A as API (TransferService)
    participant DB as PostgreSQL
    participant M as Mailer
    C->>A: POST /transfers + Idempotency-Key
    A->>A: Zod: monto, concepto, referencia, destino
    A->>DB: BEGIN; INSERT … ON CONFLICT DO NOTHING (reclamo de la llave)
    alt llave ya usada
        A->>DB: SELECT transferencia existente
        A-->>C: 200 estado actual / 422 reutilizada
    else llave nueva
        A->>DB: lock daily_transfer_usage (si THIRD_PARTY)
        A->>DB: SELECT cuentas … ORDER BY id FOR NO KEY UPDATE (con propiedad)
        A->>A: t1 = clock.now(); validar saldo y límite
        alt rechazo de negocio
            A->>DB: status = REJECTED + audit TRANSFER_REJECTED; COMMIT
            A-->>C: 422 con transferId
        else monto > umbral
            A->>DB: status = PENDING_OTP, one_time_codes, audit; COMMIT
            A->>M: correo con código y detalle (después del COMMIT)
            A-->>C: 201 PENDING_OTP (deliveryStatus SENT o FAILED)
        else monto <= umbral
            A->>DB: asientos, saldos, contador, COMPLETED, audit; COMMIT (trigger Σ=0)
            A-->>C: 201 COMPLETED
        end
    end
```

La confirmación sigue el mismo patrón: bloquea el contador, luego la transferencia (`FOR UPDATE`), luego las cuentas; si ya está `COMPLETED` responde 200 sin tocar el código; si está vencida responde 409; valida el código con el mecanismo de `one_time_codes`; revalida saldo y límite y completa o marca `FAILED`.

### 5. Máquina de estados de la transferencia

```mermaid
stateDiagram-v2
    [*] --> COMPLETED: monto <= 10,000.00 y validaciones OK
    [*] --> REJECTED: saldo insuficiente o límite excedido
    [*] --> PENDING_OTP: monto > 10,000.00 y validaciones OK
    PENDING_OTP --> COMPLETED: OTP correcto y revalidación OK
    PENDING_OTP --> FAILED: revalidación falla (saldo o límite)
    PENDING_OTP --> FAILED: tercer OTP incorrecto
    PENDING_OTP --> EXPIRED: 5 min sin confirmar (calculado al leer)
    COMPLETED --> [*]
    REJECTED --> [*]
    FAILED --> [*]
    EXPIRED --> [*]
```

La máquina vive en el dominio como función pura (estado actual + evento → nuevo estado o error) con pruebas unitarias de todas las transiciones, incluidas las inválidas.

### 6. Ledger de partida doble

- **Asientos:** una transferencia completada inserta exactamente dos filas en `ledger_entries` con montos `-X` y `+X`, el `type` correspondiente a cada lado (`TRANSFER_OUT`/`TRANSFER_IN`, `OWN_TRANSFER_OUT`/`OWN_TRANSFER_IN`; en el fondeo solo el lado USER es `DEPOSIT`, y el lado de la Tesorería usa `TRANSFER_OUT`), `created_at = completed_at` y `balance_after_cents` calculado a partir del saldo leído bajo bloqueo.
- **Trigger de suma cero:** `tg_ledger_entries_zero_sum`, un `CONSTRAINT TRIGGER AFTER INSERT … DEFERRABLE INITIALLY DEFERRED FOR EACH ROW` que al hacer `COMMIT` verifica, para el `transfer_id` del asiento, que haya exactamente 2 asientos, que sumen 0 y que la transferencia esté `COMPLETED`. Si no, `RAISE EXCEPTION … USING ERRCODE = 'check_violation', CONSTRAINT = 'tg_ledger_entries_zero_sum'`, de modo que el mapeo por nombre lo reconozca (y lo trate como 500 con alerta, porque indica un error de código).
- **Completadas con asientos:** `tg_transfers_completed_has_entries`, también diferido, verifica que una transferencia que pasa a `COMPLETED` tenga sus 2 asientos.
- **Inmutabilidad:** `wallet_app` solo tiene `SELECT, INSERT` sobre `ledger_entries` (sin `UPDATE`, `DELETE` ni `TRUNCATE`); además `tg_ledger_entries_immutable` (`BEFORE UPDATE OR DELETE FOR EACH ROW`) y `tg_ledger_entries_no_truncate` (`BEFORE TRUNCATE FOR EACH STATEMENT`) ejecutan la función `forbid_mutation()` que crea api-foundation para `audit_log`, y lanzan excepción incluso para el dueño. Una corrección contable se haría con un contraasiento, nunca editando.
- **Consultas de conciliación** (usadas por pruebas y documentadas para la sesión en vivo):

```sql
-- saldo = suma de asientos, por cuenta
SELECT a.id FROM accounts a
LEFT JOIN ledger_entries e ON e.account_id = a.id
GROUP BY a.id, a.balance_cents
HAVING a.balance_cents <> COALESCE(SUM(e.amount_cents), 0);          -- debe devolver 0 filas

-- suma global cero
SELECT SUM(amount_cents) FROM ledger_entries;                          -- debe ser 0

-- cadena de balance_after
SELECT * FROM (
  SELECT account_id, balance_after_cents,
         SUM(amount_cents) OVER (PARTITION BY account_id ORDER BY created_at, id) AS running
  FROM ledger_entries) t
WHERE balance_after_cents <> running;                                  -- debe devolver 0 filas
```

**Alternativas descartadas:** calcular el saldo siempre como `SUM` de asientos (sin columna de saldo): no permite un `CHECK` de no negativo y hace caro `GET /accounts`; validar la suma cero solo en código: el enunciado pide integridad en la base.

### 7. Límite diario con fila contador

- Fila `daily_transfer_usage (user_id, day)` con `limit_cents` copiado de la configuración (`DAILY_TRANSFER_LIMIT`, 50,000.00) al crear la fila, para que el `CHECK used_cents <= limit_cents` pueda vivir en la misma tabla.
- Solo las transferencias `THIRD_PARTY` la tocan. Primero `INSERT … ON CONFLICT (user_id, day) DO NOTHING` y después `SELECT … FOR UPDATE`; el `UPDATE used_cents = used_cents + $monto` ocurre únicamente en la transición a `COMPLETED`.
- El servicio valida `used + monto <= limit` para responder `DAILY_LIMIT_EXCEEDED` con `remaining`; si alguna vez la red (`ck_daily_transfer_usage_within_limit`) actúa, se traduce al mismo código y se registra un log de nivel ERROR, porque significa que la validación del servicio falló.
- `GET /accounts` lee la fila del día actual (o asume 0) y calcula `remaining` y `resetsAt` (siguiente medianoche de `America/Mexico_City` en UTC). La zona horaria es una constante del dominio, no configuración.

**Alternativa descartada:** `SUM` de transferencias del día bajo un bloqueo de la fila de `users`. Siempre lee de la fuente de verdad, pero su costo crece con los movimientos y el límite no queda protegido por la base.

### 8. OTP de transferencias

- El código se crea en `one_time_codes` con propósito `TRANSFER_CONFIRMATION` y `subject_id = transfer.id`, usando el mismo mecanismo de hash, intentos y reenvíos de `api-foundation`. `transfers.otp_expires_at` replica la vigencia para calcular `EXPIRED` sin unir tablas.
- El correo se envía **después del `COMMIT`**, de forma síncrona. Si el envío falla, la respuesta es 201 con `deliveryStatus: FAILED` y el cliente ofrece reenviar. Contenido: código, monto formateado en es-MX, `displayName` del destino y últimos 4 dígitos de la CLABE.
- Reenvío: bloquea la transferencia, verifica `PENDING_OTP` vigente y `resend_count < 3`, invalida el código anterior, crea uno nuevo con intentos en 3, mueve `otp_expires_at` y registra `TRANSFER_OTP_RESENT`.
- Valores por configuración: `OTP_THRESHOLD` (10,000.00, comparación `>`), `OTP_TTL_SECONDS` (300), `OTP_MAX_ATTEMPTS` (3), `OTP_MAX_RESENDS` (3).

**Alternativa descartada:** enviar el correo dentro de la transacción. Si el `COMMIT` fallara después de enviarlo, el usuario recibiría un código de una transferencia inexistente, y la transacción quedaría abierta durante la latencia del SMTP reteniendo bloqueos.

### 9. Beneficiarios

- Validación en el orden del requisito BEN-06; el código de banco de la plataforma viene de la configuración de `api-foundation` (ACC-03).
- Resolución: `SELECT id, user_id FROM accounts WHERE clabe = $1 AND type = 'USER'`. Se guarda `account_id` resuelto, por lo que la transferencia a un beneficiario no vuelve a buscar por CLABE.
- Idempotencia por contenido: antes de insertar se busca `(user_id, clabe)` y `(user_id, alias)`; si la CLABE existe con el mismo nombre y alias → 200; si difiere → 409. Ante una carrera, el `23505` de `uq_beneficiaries_user_clabe` o `uq_beneficiaries_user_alias` se resuelve volviendo a leer y aplicando la misma regla (200 si coincide todo, 409 si no).
- Rate limit: 10 altas por hora por usuario con el limitador de `api-foundation`.

### 10. Historial de movimientos

```sql
SELECT e.id, e.type, e.amount_cents, e.balance_after_cents, e.created_at,
       t.id AS transfer_id, t.concept, t.reference, … contraparte …
FROM ledger_entries e
JOIN transfers t ON t.id = e.transfer_id
WHERE e.account_id = $1
  AND e.created_at >= $from_utc AND e.created_at < $to_utc_exclusive   -- opcionales
  AND e.type = ANY($types)                                              -- opcional
  AND (e.created_at, e.id) < ($cursor_ts, $cursor_id)                   -- desde la 2ª página
ORDER BY e.created_at DESC, e.id DESC
LIMIT $limit + 1;                                                       -- la fila extra indica que hay otra página
```

- **Índices:** `ix_ledger_entries_account_created (account_id, created_at DESC, id DESC)` para la consulta sin tipo y `ix_ledger_entries_account_type_created (account_id, type, created_at DESC, id DESC)` para la filtrada por un tipo poco frecuente. La comparación de filas `(created_at, id) < (…)` usa el índice como límite del recorrido.
- **Cursor:** `base64url(JSON {t, id, f})` donde `f` es el hash de los filtros normalizados, más una firma HMAC-SHA256 con `CURSOR_SIGNING_SECRET`. Firma inválida o `f` distinto a los filtros actuales → `400 INVALID_CURSOR`. La firma es lo que permite detectar un cursor alterado.
- **Fechas:** `from` y `to` son días de `America/Mexico_City`; se convierten a `[from 00:00 CDMX, (to + 1) 00:00 CDMX)` en UTC, igual que la definición de día del límite.
- **Contraparte:** se obtiene uniendo el asiento opuesto de la misma transferencia y su cuenta: nombre del remitente (`users.full_name`) en entradas, alias del beneficiario en salidas a terceros, nombre de la cuenta en traspasos propios, nula en `DEPOSIT`; últimos 4 dígitos de la CLABE cuando existe.

**Alternativas descartadas:** paginación por `OFFSET` (el enunciado la prohíbe, y su costo crece con la profundidad); cursor sin firma (un cursor alterado podría producir páginas incoherentes sin que la API lo note); índice parcial por tipo (cinco índices en lugar de uno compuesto).

### 11. Dónde TypeORM no alcanza

| Necesidad | Solución |
|---|---|
| `BIGINT` sin perder precisión | El driver devuelve `int8` como string; un transformer de columna convierte `string ⇄ bigint` y el dominio usa `Money` con `BigInt`. Nunca `Number(...)` |
| Bloqueo de varias filas con verificación de propiedad y orden | SQL crudo con `QueryRunner`: `SELECT … WHERE id = ANY($1) AND … ORDER BY id FOR NO KEY UPDATE` (el `setLock` de TypeORM no permite expresar el orden, la propiedad y la variante `NO KEY` en una sola sentencia de forma legible) |
| Reclamo de la llave | `INSERT … ON CONFLICT ON CONSTRAINT … DO NOTHING RETURNING id` en SQL crudo |
| Fila contador | `INSERT … ON CONFLICT DO NOTHING` + `SELECT … FOR UPDATE` en SQL crudo |
| Trigger diferido de suma cero, triggers de inmutabilidad, constraints con nombre, grants | SQL crudo en migraciones TypeORM (`queryRunner.query`), cada una con su `down` |
| Paginación keyset con comparación de filas | SQL crudo parametrizado |
| Generación masiva del seed (`generate_series`, funciones de ventana) | SQL crudo por lotes |

Toda la transacción de una transferencia corre en un único `QueryRunner` con `startTransaction()`; el escritor de auditoría recibe ese mismo `QueryRunner` (AUD-03).

### 12. Traducción de errores de este change

| Constraint | Respuesta | Log |
|---|---|---|
| `ck_accounts_balance_non_negative` | 422 `INSUFFICIENT_FUNDS` | ERROR (la red actuó) |
| `ck_daily_transfer_usage_within_limit` | 422 `DAILY_LIMIT_EXCEEDED` | ERROR (la red actuó) |
| `uq_beneficiaries_user_clabe`, `uq_beneficiaries_user_alias` | reevaluación → 200 o 409 `BENEFICIARY_CONFLICT` | — |
| `ck_transfers_distinct_accounts` | 422 `SAME_ACCOUNT_TRANSFER` | ERROR (debió atraparse antes) |
| `ck_beneficiaries_clabe_valid` | 422 `CLABE_INVALID` | ERROR (debió atraparse antes) |
| `uq_transfers_user_idempotency_key` | no debería ocurrir (`ON CONFLICT`) → 500 | ERROR + alerta |
| `fk_transfers_from_account`, `fk_transfers_to_account`, `fk_transfers_beneficiary` | 404 `NOT_FOUND` (cuenta o beneficiario inexistente) | WARN |
| `tg_ledger_entries_zero_sum`, `tg_transfers_completed_has_entries` | 500 `INTERNAL_ERROR` | ERROR + alerta |

### 13. Valor `Money` y validación del monto

`Money` es un value object con `cents: bigint`. `Money.parse(input: string)` acepta solo `^(0|[1-9]\d{0,11})(\.\d{1,2})?$` y mayor que cero, y convierte por manipulación de strings (parte entera × 100 + centavos), nunca con aritmética de punto flotante. `toDecimalString()` siempre produce 2 decimales. El esquema Zod de entrada exige `z.string()`, por lo que un número JSON se rechaza antes del parseo. Pruebas unitarias con los vectores de la exploración (`"1250.5"`, `"100.005"`, `"0.00"`, `1250.5` número, `"1e3"`, `" 10.00"`, `"007.00"`, 13 dígitos enteros).

### 14. Seed de volumen y script de fondeo

**`npm run db:seed`** (como `wallet_migrator`), idempotente sobre una base vacía:
1. Crea usuarios verificados: Ana y Luis (credenciales demo documentadas en el README de `/api`) y ~50 usuarios generados, con CURP, RFC y teléfono sintéticos que cumplen formato y dígito verificador; sus cuentas "Principal" y "Ahorro" con CLABE de la secuencia.
2. Fondea cada cuenta desde la Tesorería con asientos de apertura al inicio del periodo (12 meses antes de ayer), con montos suficientes para que ningún saldo pueda quedar negativo, y registra `FUNDING_POSTED`.
3. Genera ~60k transferencias completadas (~120k asientos) con `generate_series` en lotes de ~5k transferencias por transacción: montos pequeños, timestamps crecientes distribuidos en los 12 meses y **terminando ayer a las 23:59 de CDMX**, con la cuenta "Principal" de Ana participando en ~60k asientos (entradas y salidas para que su saldo no se agote).
4. Calcula `balance_after_cents` con `SUM() OVER (PARTITION BY account_id ORDER BY created_at, id)` en una tabla de staging **antes** de insertar en `ledger_entries` (no se puede actualizar después, por la inmutabilidad), e inserta en orden.
5. Fija `accounts.balance_cents` al último `balance_after` de cada cuenta y ejecuta `ANALYZE`.
6. Verifica las invariantes (conciliación, suma global cero, ningún `balance_after` negativo, nada en el día actual) y **falla** si alguna no se cumple.

Las transferencias históricas sintéticas no generan eventos de auditoría (sí los fondeos); se documenta como decisión del seed. El trigger diferido se ejecuta por cada asiento; los lotes mantienen acotado su costo, y el tiempo total se mide y se anota en el README.

**`npm run db:fund -- --account <id|clabe> --amount <monto>`** usa el mismo servicio de asientos que las transferencias (no SQL directo), con actor `SYSTEM`, validando el monto con `Money.parse`.

## Risks / Trade-offs

- [La fila contador serializa todas las transferencias a terceros de un mismo usuario] → Es el comportamiento buscado; la contención es por usuario, no global.
- [La Tesorería sería un punto caliente con un endpoint de depósito] → Hoy solo se fondea en el seed y con el script; se menciona en la propuesta de AWS ("si el volumen crece 100x").
- [`balance_after` no está protegido por una constraint de la base] → Consulta de conciliación de la cadena en las pruebas y en el seed.
- [El trigger diferido agrega costo por asiento] → Se mide con el seed de 120k; si fuera relevante se cambiaría a un trigger por sentencia con tablas de transición.
- [Hora de varias instancias de la API con relojes distintos] → El `Clock` usa la hora del sistema; en AWS, Amazon Time Sync (se documenta en `aws-deploy.md`).
- [Muchas filas `REJECTED` por abuso] → Rate limiting general de la plataforma (PLT-09); las filas rechazadas son también una señal de fraude.
- [Rotar `CURSOR_SIGNING_SECRET` invalida los cursores vigentes] → Aceptable: el cliente reinicia la paginación.
- [Fuerza bruta del OTP] → 3 intentos por código y 3 reenvíos: a lo más 12 intentos sobre 10⁶ combinaciones.
- [Supuestos de nombres de `api-foundation`] → Se listan en Context; al aplicar se verifica contra su `design.md` y migraciones.

## Migration Plan

Migraciones en este orden, cada una con `down` y con sus grants explícitos para `wallet_app`:
1. `beneficiaries` (constraints, `ck_beneficiaries_clabe_valid`, grants `SELECT, INSERT`).
2. `transfers` (constraints, grants `SELECT, INSERT, UPDATE`).
3. `ledger_entries` (constraints, índices, triggers diferidos e inmutables, grants `SELECT, INSERT`).
4. `daily_transfer_usage` (constraints, grants `SELECT, INSERT, UPDATE`).
5. `tg_transfers_completed_has_entries`.

Rollback: `db:migrate:revert` en orden inverso; los `down` eliminan triggers, funciones e índices antes que las tablas.

## Notas de implementación

Decisiones tomadas al implementar que precisan o ajustan este diseño, sin cambiar requisitos:

- **Referencia como entero:** `transfers.reference` es `integer` (0 a 9999999) y la huella usa el valor interpretado, así que `"0001234"` y `"1234"` son el mismo contenido para la idempotencia; las respuestas devuelven `"1234"`.
- **Ids mal formados responden 404:** `getAccount`, `getTransfer`, `confirmTransfer`, `resendTransferOtp` y `listAccountMovements` responden `404 NOT_FOUND` a un id que no es UUID, igual que a uno inexistente o ajeno. El contrato no declara `422` para el parámetro de ruta (ver huecos del contrato).
- **Reintento de una transferencia no completada:** con la misma llave, una `REJECTED` repite el mismo `422` (con `Idempotent-Replayed` y `remaining` recalculado al momento); una `FAILED`, `PENDING_OTP` o vencida responde `200` con su estado actual. TRF-03 habla de la "rechazada", que es `REJECTED`; un `FAILED` ocurrió al confirmar, no al crear.
- **`dailyLimit` de `GET /accounts`:** usa el `limit_cents` de la fila del día si existe (el límite vigente cuando se creó) y acota `remaining` a cero.
- **`deliveryStatus` no se guarda:** la creación y el reenvío informan el resultado real del envío; las lecturas posteriores (`getTransfer`, reintentos) informan `SENT`, porque el contrato lo exige en cada `OtpChallenge` y la base no lo persiste (ver huecos del contrato). `TRANSFER_OTP_SENT` se audita dentro de la transacción (TRF-25), antes del envío; una falla de envío queda en el log, no en la auditoría.
- **Orden de bloqueos de la confirmación:** fila contador → transferencia (`FOR UPDATE`, con el dueño en la misma sentencia) → código (`one_time_codes`, `FOR UPDATE`) → cuentas. El código se valida antes de bloquear las cuentas para que un código incorrecto no las retenga; el reenvío toma transferencia → código, así que no hay ciclos. `TransferLocker` expone sus pasos (`lockCounter`, `lockAccounts`) para intercalar la transferencia. Si la medianoche llega mientras espera, el reintento vuelve a validar el código (su consumo se revirtió). Una `PENDING_OTP` sin código usable es un estado inconsistente y responde 500.
- **Eventos de la confirmación:** `OTP_ATTEMPT_FAILED` y `OTP_ATTEMPTS_EXHAUSTED` llevan `purpose: TRANSFER_CONFIRMATION` y `attemptsRemaining`; `TRANSFER_FAILED`, `reason` y `amount`. Los intentos fallidos y los `FAILED` se confirman antes de responder el error.
- **Comprobante solo para quien envía:** `getTransfer` responde 404 a quien recibió la transferencia y a los fondeos (`FUNDING`), como dice el contrato en `Movement.transferId`.
- **`displayName` y contraparte de un beneficiario:** su alias. Entre cuentas propias, el nombre de la cuenta; en las entradas, el nombre completo del remitente. Siempre solo los últimos 4 dígitos de la CLABE.
- **Correo del OTP:** monto con `Money.toDisplayString()` (es-MX armado con aritmética de centavos, sin depender de los datos de ICU del entorno), nombre del destino y últimos 4 dígitos; nunca la CLABE completa.
- **Historial:** el `LIMIT` se aplica en una subconsulta antes de unir nada y las uniones son `JOIN LATERAL`; con joins normales el planificador elegía un hash join y agregaba un `Sort` (ver EXPLAIN ANALYZE). El cursor guarda el momento con microsegundos (la precisión de `timestamptz`) y la respuesta lo muestra con milisegundos. La firma del cursor se compara como texto: comparar los bytes decodificados aceptaría un cursor con los bits sobrantes de su último carácter cambiados a mano. El hash de filtros incluye la cuenta.
- **Filtros del historial:** un `type` repetido es 422 (el contrato declara `uniqueItems`), igual que un parámetro desconocido o un escalar repetido (`limit=10&limit=20`); `to` anterior a `from` se reporta en `/to` con `INVALID_DATE`.
- **Restricciones adicionales al diseño:** `ck_transfers_fingerprint_hex`, checks de `kind`, `status` y motivos por estado, `ck_daily_transfer_usage_limit_positive` e índices de llaves foráneas (`ix_transfers_from_account`, `ix_transfers_to_account`, `ix_transfers_beneficiary`, `ix_beneficiaries_account`). Los constraint triggers aparecen en `pg_constraint` con `contype = 't'` y la prueba de nombres los acepta con prefijo `tg_`.
- **Seed:** los 50 usuarios generados comparten una contraseña demo (un solo hash argon2); los beneficiarios del seed no generan `BENEFICIARY_CREATED` y las transferencias históricas no generan eventos `TRANSFER_*` (son datos de desarrollo), pero todo fondeo, inicial o periódico, se audita con `FUNDING_POSTED`. Todas las transferencias generadas tienen un lado en "Principal" de Ana (60,013 asientos de 120,128). La regla de "nada del día actual" solo revisa los asientos que agrega cada corrida, para que un `db:fund` de hoy no haga fallar otro `db:seed`; las demás invariantes revisan todo el ledger. Tarda 10.7 s en local.
- **Prueba de planes con volumen real:** con unos miles de asientos el planificador elige para `DEPOSIT` un `Bitmap Heap Scan` seguido de `Sort` (barato con 13 filas), así que la prueba automatizada siembra el volumen completo (≈14 s, con timeout propio).
- **Validación de contrato en todas las pruebas:** el helper `authed()` valida sola cada respuesta contra la operación que corresponde a su método y ruta, además del recorrido de contrato de la tarea 12.1.

### Huecos del contrato (ninguno bloqueante)

1. **Id de ruta mal formado:** las operaciones con `{accountId}` o `{transferId}` no declaran `422`; se eligió `404 NOT_FOUND`, que sí está declarado y no revela nada.
2. **`OtpChallenge.deliveryStatus` en lecturas:** es obligatorio en cada transferencia pendiente, pero solo tiene sentido en la respuesta que hizo el envío. Las lecturas dicen `SENT`. Si la app necesita saber después que el correo falló, el contrato podría hacerlo opcional o la API persistirlo.
3. **Extensiones del Problem:** `transferId`, `remaining`, `attemptsRemaining` y `transferStatus` son opcionales en el esquema; las pruebas exigen su presencia en los códigos donde el contrato las describe.

## EXPLAIN ANALYZE

Capturado con la tarea 11.4 el 2026-10-13 en el PostgreSQL 16.14 del `docker compose` local, después de `npm run db:seed` (120,128 asientos en total, 60,013 en la cuenta "Principal" de Ana; el seed termina con `ANALYZE`). Se ejecutó `EXPLAIN (ANALYZE, BUFFERS)` con el rol de la aplicación sobre el SQL exacto que genera `buildMovementQuery` (el mismo que usa `PgMovementReader`), con `limit` 20, es decir `LIMIT 21`.

| Consulta | Índice del recorrido | Nodo `Sort` | Tiempo de ejecución |
|---|---|---|---|
| Primera página sin filtros (limit 20 → LIMIT 21) | `ix_ledger_entries_account_created` | no | 0.771 ms |
| Filtrada por DEPOSIT (tipo poco frecuente) | `ix_ledger_entries_account_type_created` | no | 0.170 ms |
| Rango antiguo 2025-11-01 a 2025-11-30, segunda página con cursor | `ix_ledger_entries_account_created` | no | 0.742 ms |

**Hallazgo al capturarlos:** la primera versión de la consulta unía transferencia, asiento opuesto, cuenta, usuario y beneficiario con `JOIN` normales; el planificador eligió un `Hash Left Join` para `users` y tuvo que volver a ordenar al final, así que los tres planes terminaban en un nodo `Sort` (de solo 21 filas, pero HIS-09 pide que no exista). Se cambiaron esos joins por `JOIN LATERAL` sobre la página ya limitada: los `Nested Loop` conservan el orden del recorrido por índice y el `ORDER BY` externo queda satisfecho sin ordenar. La prueba automatizada de planes (tarea 11.5) fija este comportamiento. Las tablas pequeñas (`accounts`, `beneficiaries`) se leen con `Seq Scan` dentro del lateral porque tienen decenas de filas; con más usuarios el planificador pasaría a sus llaves primarias.

### 1. Primera página sin filtros (limit 20 → LIMIT 21)

Recorrido `Index Scan using ix_ledger_entries_account_created` con `Index Cond` sobre la cuenta; el `Limit` corta a las 21 filas (20 + 1 para saber si hay otra página) después de leer 4 páginas del índice.

```text
Nested Loop Left Join  (cost=5.47..330.46 rows=42 width=200) (actual time=0.082..0.678 rows=21 loops=1)
  Buffers: shared hit=278
  ->  Nested Loop  (cost=0.84..93.31 rows=21 width=120) (actual time=0.029..0.140 rows=21 loops=1)
        Buffers: shared hit=88
        ->  Limit  (cost=0.42..3.84 rows=21 width=77) (actual time=0.012..0.015 rows=21 loops=1)
              Buffers: shared hit=4
              ->  Index Scan using ix_ledger_entries_account_created on ledger_entries e  (cost=0.42..9815.46 rows=60300 width=77) (actual time=0.011..0.013 rows=21 loops=1)
                    Index Cond: (account_id = 'c4319c65-6ad7-4a62-a537-bfd3c0241473'::uuid)
                    Buffers: shared hit=4
        ->  Memoize  (cost=0.42..8.44 rows=1 width=43) (actual time=0.006..0.006 rows=1 loops=21)
              Cache Key: e.transfer_id
              Cache Mode: logical
              Hits: 0  Misses: 21  Evictions: 0  Overflows: 0  Memory Usage: 4kB
              Buffers: shared hit=84
              ->  Index Scan using pk_transfers on transfers t  (cost=0.41..8.43 rows=1 width=43) (actual time=0.005..0.005 rows=1 loops=21)
                    Index Cond: (id = e.transfer_id)
                    Buffers: shared hit=84
  ->  Result  (cost=4.63..11.25 rows=2 width=64) (actual time=0.022..0.025 rows=1 loops=21)
        One-Time Filter: (e.type <> 'DEPOSIT'::text)
        Buffers: shared hit=190
        ->  Nested Loop Left Join  (cost=4.63..11.24 rows=2 width=56) (actual time=0.022..0.024 rows=1 loops=21)
              Buffers: shared hit=190
              ->  Nested Loop Left Join  (cost=4.62..9.45 rows=2 width=51) (actual time=0.020..0.022 rows=1 loops=21)
                    Buffers: shared hit=169
                    ->  Hash Join  (cost=4.48..8.82 rows=2 width=43) (actual time=0.015..0.017 rows=1 loops=21)
                          Hash Cond: (other.id = o.account_id)
                          Buffers: shared hit=127
                          ->  Seq Scan on accounts other  (cost=0.00..4.05 rows=105 width=59) (actual time=0.000..0.004 rows=105 loops=21)
                                Buffers: shared hit=63
                          ->  Hash  (cost=4.46..4.46 rows=2 width=16) (actual time=0.008..0.008 rows=1 loops=21)
                                Buckets: 1024  Batches: 1  Memory Usage: 9kB
                                Buffers: shared hit=64
                                ->  Index Only Scan using uq_ledger_entries_transfer_account on ledger_entries o  (cost=0.42..4.46 rows=2 width=16) (actual time=0.003..0.003 rows=1 loops=21)
                                      Index Cond: (transfer_id = e.transfer_id)
                                      Filter: (account_id <> e.account_id)
                                      Rows Removed by Filter: 1
                                      Heap Fetches: 0
                                      Buffers: shared hit=64
                    ->  Index Scan using pk_users on users sender  (cost=0.14..0.31 rows=1 width=40) (actual time=0.001..0.001 rows=1 loops=21)
                          Index Cond: (id = other.user_id)
                          Buffers: shared hit=42
              ->  Materialize  (cost=0.00..1.77 rows=1 width=5) (actual time=0.002..0.002 rows=1 loops=21)
                    Buffers: shared hit=21
                    ->  Seq Scan on beneficiaries b  (cost=0.00..1.76 rows=1 width=5) (actual time=0.001..0.001 rows=1 loops=21)
                          Filter: (id = t.beneficiary_id)
                          Rows Removed by Filter: 27
                          Buffers: shared hit=21
Planning:
  Buffers: shared hit=16
Planning Time: 0.366 ms
Execution Time: 0.771 ms
```

### 2. Filtrada por DEPOSIT (tipo poco frecuente)

Recorrido `Index Scan using ix_ledger_entries_account_type_created` con `Index Cond` sobre cuenta y tipo: lee solo los 13 depósitos de la cuenta en lugar de filtrar 60,013 asientos.

```text
Nested Loop Left Join  (cost=5.47..410.72 rows=42 width=200) (actual time=0.026..0.107 rows=13 loops=1)
  Buffers: shared hit=68
  ->  Nested Loop  (cost=0.84..173.57 rows=21 width=120) (actual time=0.023..0.095 rows=13 loops=1)
        Buffers: shared hit=68
        ->  Limit  (cost=0.42..84.10 rows=21 width=77) (actual time=0.012..0.021 rows=13 loops=1)
              Buffers: shared hit=16
              ->  Index Scan using ix_ledger_entries_account_type_created on ledger_entries e  (cost=0.42..135.91 rows=34 width=77) (actual time=0.012..0.020 rows=13 loops=1)
                    Index Cond: ((account_id = 'c4319c65-6ad7-4a62-a537-bfd3c0241473'::uuid) AND (type = 'DEPOSIT'::text))
                    Buffers: shared hit=16
        ->  Memoize  (cost=0.42..8.44 rows=1 width=43) (actual time=0.005..0.005 rows=1 loops=13)
              Cache Key: e.transfer_id
              Cache Mode: logical
              Hits: 0  Misses: 13  Evictions: 0  Overflows: 0  Memory Usage: 2kB
              Buffers: shared hit=52
              ->  Index Scan using pk_transfers on transfers t  (cost=0.41..8.43 rows=1 width=43) (actual time=0.005..0.005 rows=1 loops=13)
                    Index Cond: (id = e.transfer_id)
                    Buffers: shared hit=52
  ->  Result  (cost=4.63..11.25 rows=2 width=64) (actual time=0.000..0.000 rows=0 loops=13)
        One-Time Filter: (e.type <> 'DEPOSIT'::text)
        ->  Nested Loop Left Join  (cost=4.63..11.24 rows=2 width=56) (never executed)
              ->  Nested Loop Left Join  (cost=4.62..9.45 rows=2 width=51) (never executed)
                    ->  Hash Join  (cost=4.48..8.82 rows=2 width=43) (never executed)
                          Hash Cond: (other.id = o.account_id)
                          ->  Seq Scan on accounts other  (cost=0.00..4.05 rows=105 width=59) (never executed)
                          ->  Hash  (cost=4.46..4.46 rows=2 width=16) (never executed)
                                ->  Index Only Scan using uq_ledger_entries_transfer_account on ledger_entries o  (cost=0.42..4.46 rows=2 width=16) (never executed)
                                      Index Cond: (transfer_id = e.transfer_id)
                                      Filter: (account_id <> e.account_id)
                                      Heap Fetches: 0
                    ->  Index Scan using pk_users on users sender  (cost=0.14..0.31 rows=1 width=40) (never executed)
                          Index Cond: (id = other.user_id)
              ->  Materialize  (cost=0.00..1.77 rows=1 width=5) (never executed)
                    ->  Seq Scan on beneficiaries b  (cost=0.00..1.76 rows=1 width=5) (never executed)
                          Filter: (id = t.beneficiary_id)
Planning:
  Buffers: shared hit=16
Planning Time: 0.351 ms
Execution Time: 0.170 ms
```

### 3. Rango antiguo 2025-11-01 a 2025-11-30, segunda página con cursor

Mismo índice que la primera consulta, con el rango de fechas y la comparación de filas `(created_at, id) < (…)` del cursor dentro del `Index Cond`: el recorrido empieza justo después del último movimiento de la página anterior, sin `OFFSET`.

```text
Nested Loop Left Join  (cost=5.47..395.55 rows=42 width=200) (actual time=0.066..0.631 rows=21 loops=1)
  Buffers: shared hit=278
  ->  Nested Loop  (cost=0.84..158.41 rows=21 width=120) (actual time=0.018..0.101 rows=21 loops=1)
        Buffers: shared hit=88
        ->  Limit  (cost=0.42..68.93 rows=21 width=77) (actual time=0.009..0.012 rows=21 loops=1)
              Buffers: shared hit=4
              ->  Index Scan using ix_ledger_entries_account_created on ledger_entries e  (cost=0.42..2166.82 rows=664 width=77) (actual time=0.009..0.011 rows=21 loops=1)
                    Index Cond: ((account_id = 'c4319c65-6ad7-4a62-a537-bfd3c0241473'::uuid) AND (created_at >= '2025-11-01 06:00:00+00'::timestamp with time zone) AND (created_at < '2025-12-01 06:00:00+00'::timestamp with time zone) AND (ROW(created_at, id) < ROW('2025-12-01 03:09:58.8+00'::timestamp with time zone, '16179'::bigint)))
                    Buffers: shared hit=4
        ->  Memoize  (cost=0.42..8.44 rows=1 width=43) (actual time=0.004..0.004 rows=1 loops=21)
              Cache Key: e.transfer_id
              Cache Mode: logical
              Hits: 0  Misses: 21  Evictions: 0  Overflows: 0  Memory Usage: 4kB
              Buffers: shared hit=84
              ->  Index Scan using pk_transfers on transfers t  (cost=0.41..8.43 rows=1 width=43) (actual time=0.004..0.004 rows=1 loops=21)
                    Index Cond: (id = e.transfer_id)
                    Buffers: shared hit=84
  ->  Result  (cost=4.63..11.25 rows=2 width=64) (actual time=0.022..0.024 rows=1 loops=21)
        One-Time Filter: (e.type <> 'DEPOSIT'::text)
        Buffers: shared hit=190
        ->  Nested Loop Left Join  (cost=4.63..11.24 rows=2 width=56) (actual time=0.022..0.024 rows=1 loops=21)
              Buffers: shared hit=190
              ->  Nested Loop Left Join  (cost=4.62..9.45 rows=2 width=51) (actual time=0.020..0.022 rows=1 loops=21)
                    Buffers: shared hit=169
                    ->  Hash Join  (cost=4.48..8.82 rows=2 width=43) (actual time=0.014..0.017 rows=1 loops=21)
                          Hash Cond: (other.id = o.account_id)
                          Buffers: shared hit=127
                          ->  Seq Scan on accounts other  (cost=0.00..4.05 rows=105 width=59) (actual time=0.000..0.004 rows=105 loops=21)
                                Buffers: shared hit=63
                          ->  Hash  (cost=4.46..4.46 rows=2 width=16) (actual time=0.007..0.007 rows=1 loops=21)
                                Buckets: 1024  Batches: 1  Memory Usage: 9kB
                                Buffers: shared hit=64
                                ->  Index Only Scan using uq_ledger_entries_transfer_account on ledger_entries o  (cost=0.42..4.46 rows=2 width=16) (actual time=0.002..0.002 rows=1 loops=21)
                                      Index Cond: (transfer_id = e.transfer_id)
                                      Filter: (account_id <> e.account_id)
                                      Rows Removed by Filter: 1
                                      Heap Fetches: 0
                                      Buffers: shared hit=64
                    ->  Index Scan using pk_users on users sender  (cost=0.14..0.31 rows=1 width=40) (actual time=0.001..0.001 rows=1 loops=21)
                          Index Cond: (id = other.user_id)
                          Buffers: shared hit=42
              ->  Materialize  (cost=0.00..1.77 rows=1 width=5) (actual time=0.002..0.002 rows=1 loops=21)
                    Buffers: shared hit=21
                    ->  Seq Scan on beneficiaries b  (cost=0.00..1.76 rows=1 width=5) (actual time=0.001..0.001 rows=1 loops=21)
                          Filter: (id = t.beneficiary_id)
                          Rows Removed by Filter: 29
                          Buffers: shared hit=21
Planning:
  Buffers: shared hit=16
Planning Time: 0.348 ms
Execution Time: 0.742 ms
```
