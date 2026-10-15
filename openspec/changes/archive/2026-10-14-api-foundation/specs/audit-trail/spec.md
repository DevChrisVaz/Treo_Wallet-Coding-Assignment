## Purpose

Define la bitácora de auditoría de la billetera: qué eventos de negocio y de seguridad se registran, qué datos llevan, cómo se escriben de forma atómica con la operación que registran y cómo se garantiza en la base de datos que nadie los modifica ni los borra.

## ADDED Requirements

### Requirement: AUD-01 Catálogo de eventos auditados
La API SHALL registrar en la bitácora de auditoría los eventos de este catálogo, y solo estos:
- Identidad: `USER_REGISTERED`, `EMAIL_VERIFIED`, `EMAIL_VERIFICATION_RESENT`, `LOGIN_SUCCEEDED`, `LOGIN_FAILED` (con el motivo), `LOGOUT`.
- Seguridad: `REFRESH_TOKEN_REUSE_DETECTED`, `OTP_ATTEMPT_FAILED` y `OTP_ATTEMPTS_EXHAUSTED` (para ambos propósitos de código, indicado en los metadatos).
- Beneficiarios: `BENEFICIARY_CREATED`.
- Transferencias: `TRANSFER_CREATED` (con el estado inicial), `TRANSFER_OTP_SENT`, `TRANSFER_OTP_RESENT`, `TRANSFER_COMPLETED`, `TRANSFER_REJECTED` (con el motivo), `TRANSFER_FAILED` (con el motivo).
- Sistema: `FUNDING_POSTED`, con actor de tipo sistema.

Cada evento MUST incluir el momento en que ocurrió, el tipo de actor (`USER`, `SYSTEM` o `ANONYMOUS`), el id del actor cuando exista, la acción, el tipo y el id de la entidad afectada cuando exista, el `requestId`, la IP del cliente, el user agent y metadatos. Las lecturas MUST NOT auditarse.

#### Scenario: Login exitoso auditado
- **WHEN** un usuario inicia sesión correctamente
- **THEN** existe un evento `LOGIN_SUCCEEDED` con actor `USER`, su id, el `requestId`, la IP y el user agent de la petición

#### Scenario: Reuso de refresh token auditado
- **WHEN** se detecta el reuso de un refresh token
- **THEN** existe un evento `REFRESH_TOKEN_REUSE_DETECTED` con el id de la familia revocada en los metadatos

#### Scenario: Las lecturas no se auditan
- **WHEN** un usuario llama a `GET /me`
- **THEN** no se agrega ningún evento a la bitácora

### Requirement: AUD-02 Sin datos personales en la auditoría
Los eventos de auditoría MUST NOT contener contraseñas, tokens, códigos de un solo uso, email, teléfono, CURP, RFC ni CLABE completas. Los metadatos SHALL limitarse a ids, montos, estados, motivos y propósitos.

#### Scenario: Registro auditado sin datos personales
- **WHEN** se registra un usuario con email, CURP, RFC y teléfono
- **THEN** el evento `USER_REGISTERED` contiene el id del usuario
- **AND** ningún campo del evento contiene el email, la CURP, el RFC ni el teléfono

### Requirement: AUD-03 Escritura atómica con la operación
Todo evento que acompaña un cambio de negocio SHALL escribirse en la misma transacción que ese cambio: si el evento no se puede escribir, el cambio MUST revertirse y la operación MUST fallar. Los eventos que no acompañan un cambio de negocio, como `LOGIN_FAILED`, SHALL escribirse por separado.

#### Scenario: Falla al auditar revierte la operación
- **WHEN** la escritura del evento `EMAIL_VERIFIED` falla durante una verificación de correo
- **THEN** el usuario sigue sin verificar y no tiene cuentas abiertas
- **AND** la API responde `500 INTERNAL_ERROR`

#### Scenario: Operación revertida sin evento
- **WHEN** una operación de negocio se revierte por cualquier motivo
- **THEN** no queda en la bitácora un evento que la declare exitosa

### Requirement: AUD-04 Inmutabilidad garantizada por permisos
El rol de ejecución de la API SHALL tener únicamente el privilegio `INSERT` sobre la bitácora de auditoría. Cualquier intento de ese rol de leer, actualizar, borrar o truncar la bitácora MUST fallar con el error de permiso `42501` de PostgreSQL.

#### Scenario: El rol de ejecución intenta modificar la bitácora
- **WHEN** conectado como el rol de ejecución se ejecuta `UPDATE`, `DELETE` o `TRUNCATE` sobre la bitácora
- **THEN** cada sentencia falla con `42501`

#### Scenario: El rol de ejecución intenta leer la bitácora
- **WHEN** conectado como el rol de ejecución se ejecuta `SELECT` sobre la bitácora
- **THEN** la sentencia falla con `42501`

### Requirement: AUD-05 Inmutabilidad de respaldo ante el dueño del esquema
La bitácora de auditoría SHALL tener protecciones en la base de datos que rechacen `UPDATE`, `DELETE` y `TRUNCATE` incluso cuando los ejecuta el dueño del esquema, como defensa en profundidad ante errores operativos.

#### Scenario: El dueño del esquema intenta borrar un evento
- **WHEN** conectado como el dueño del esquema se ejecuta `DELETE` o `TRUNCATE` sobre la bitácora
- **THEN** la sentencia falla con un error que indica que la bitácora es de solo inserción

### Requirement: AUD-06 Eventos independientes de otras tablas
La bitácora SHALL ser independiente de las demás tablas: MUST NOT tener llaves foráneas, de modo que ninguna operación en otra tabla pueda bloquear, alterar o arrastrar sus eventos, y MUST poder registrar eventos cuyo sujeto no existe, como un login fallido con un email desconocido.

#### Scenario: Login fallido de un email inexistente
- **WHEN** se intenta iniciar sesión con un email que no existe
- **THEN** existe un evento `LOGIN_FAILED` con actor `ANONYMOUS` y sin id de usuario
