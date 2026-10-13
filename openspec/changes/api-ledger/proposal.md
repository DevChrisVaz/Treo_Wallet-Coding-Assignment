## Why

El enunciado prefiere "un alcance pequeño donde el dinero siempre cuadra". `api-foundation` deja listos la identidad, la plataforma (errores, logs, roles, auditoría) y la tabla de cuentas con su CLABE, pero todavía no se mueve dinero. Este change implementa el núcleo financiero de `/api`: ledger de partida doble, beneficiarios, transferencias idempotentes con OTP y límite diario, e historial de movimientos paginado. Es la parte que más se evalúa y la que debe garantizar la integridad en la base, no solo en el código.

## What Changes

- **Proyectos tocados:** `/api` únicamente. Consume `contract/openapi.yaml` (operaciones `listAccounts`, `getAccount`, `listAccountMovements`, `listBeneficiaries`, `createBeneficiary`, `createTransfer`, `getTransfer`, `confirmTransfer`, `resendTransferOtp`) sin modificarlo.
- **Historias de usuario cubiertas:** HU2 (cuentas y saldo disponible), HU3 (beneficiarios con CLABE), HU4 (transferencias a beneficiario o cuenta propia, con concepto y referencia), HU5 (historial filtrado y paginado) y HU6 (límite diario y OTP por encima de un monto).
- Ledger de partida doble: cada transferencia completada genera exactamente dos asientos que suman cero (verificado por un trigger de constraint diferido), el saldo de la cuenta se actualiza en la misma transacción con `CHECK` de no negativo, y cada asiento guarda `balance_after`. Los asientos son inmutables (privilegios de base de datos y triggers).
- Fondeo desde la cuenta SYSTEM "Tesorería" con asientos de apertura, usado por el seed y por el script `db:fund`. No hay endpoint de depósito.
- `GET /accounts` y `GET /accounts/{id}` con saldo disponible y el estado del límite diario (`limit`, `used`, `remaining`, `resetsAt`).
- Beneficiarios: cadena de validación de CLABE contra cuentas de la plataforma, rechazo de cuentas propias, idempotencia por contenido y rate limiting.
- Transferencias: llave de idempotencia obligatoria, destino como unión discriminada con verificación de propiedad dentro del bloqueo, OTP por correo para todo monto mayor a 10,000.00 MXN (incluidas cuentas propias), confirmación y reenvío, expiración perezosa, rechazos de negocio persistidos como `REJECTED`, bloqueos `SELECT … FOR UPDATE` en orden determinista y límite diario de 50,000.00 MXN por usuario con fila contador protegida por `CHECK`.
- Historial por cuenta con paginación por cursor (keyset), filtros por fecha (días de CDMX) y tipo, e índices diseñados para esa consulta.
- Seed de ~120,000 movimientos y documentación de tres planes `EXPLAIN ANALYZE` en `design.md`.
- Pruebas: unitarias (valor `Money`, fingerprint, máquina de estados), de integración contra PostgreSQL real (idempotencia, límite diario y medianoche, saldo no negativo, IDOR) y de concurrencia (100 transferencias simultáneas que cuadran al centavo).

## Capabilities

### New Capabilities
- `accounts`: requisitos ACC-10 en adelante. Saldos, límite diario visible, fondeo de la Tesorería e invariantes de conciliación (ACC-01..09 los agrega `api-foundation`).
- `beneficiaries`: alta y listado de beneficiarios identificados por CLABE de la plataforma.
- `transfers`: creación idempotente, confirmación por OTP, límite diario, ledger de partida doble y concurrencia.
- `movement-history`: historial de movimientos por cuenta con filtros, cursor e índices.

### Modified Capabilities
- Ninguna. `accounts` la crea `api-foundation` con ACC-01..09; este change agrega requisitos nuevos (ADDED) sin modificar los existentes.

## Impact

- **Base de datos:** nuevas tablas `beneficiaries`, `transfers`, `ledger_entries` y `daily_transfer_usage`; columnas de saldo usadas sobre `accounts`; función, triggers, constraints con nombre e índices nuevos; grants explícitos para `wallet_app` en cada migración.
- **API:** módulos `accounts`, `beneficiaries`, `transfers` y `movements` en las capas de dominio, aplicación e infraestructura definidas por `api-foundation`.
- **Scripts:** `npm run db:seed` (incluye la Tesorería y ~120k movimientos) y `npm run db:fund`.
- **Dependencias de otros changes:** requiere `api-foundation` (errores RFC 9457 con traducción por nombre de constraint, `Clock`, `Mailer`, escritor de auditoría, roles, `accounts` con CLABE, `one_time_codes`, arnés de pruebas). `web-app` y `mobile-app` consumen estos endpoints.
