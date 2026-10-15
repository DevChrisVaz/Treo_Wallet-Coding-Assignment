## Purpose

Exponer las cuentas del usuario con su saldo disponible y el estado de su límite diario, y garantizar que cada peso tenga origen en el ledger: el saldo de una cuenta es siempre la suma de sus asientos y el dinero solo entra al sistema desde la cuenta SYSTEM "Tesorería".

## ADDED Requirements

### Requirement: ACC-10 Consulta de cuentas con saldo disponible
La API SHALL responder `GET /accounts` (`listAccounts`) con todas las cuentas de tipo USER del usuario autenticado, cada una con su `balance` como string decimal con exactamente 2 decimales y `currency` igual a `MXN`. La respuesta MUST NOT incluir cuentas de otros usuarios ni la cuenta SYSTEM.

#### Scenario: Usuario con sus dos cuentas
- **WHEN** un usuario verificado con saldo 25000.00 en "Principal" y 0.00 en "Ahorro" consulta `GET /accounts`
- **THEN** la API responde 200 con exactamente esas dos cuentas
- **AND** los saldos son `"25000.00"` y `"0.00"`

#### Scenario: Sin token
- **WHEN** se consulta `GET /accounts` sin access token
- **THEN** la API responde 401 con `code` `UNAUTHENTICATED`

### Requirement: ACC-11 Estado del límite diario en el resumen de cuentas
La respuesta de `GET /accounts` SHALL incluir `dailyLimit` con `limit`, `used`, `remaining`, `resetsAt` y `timeZone`, donde `used` es la suma de las transferencias a terceros completadas por el usuario en el día calendario actual de `America/Mexico_City`, `remaining` es `limit - used` y `resetsAt` es la siguiente medianoche de `America/Mexico_City` expresada en UTC.

#### Scenario: Límite parcialmente usado
- **WHEN** el usuario completó hoy transferencias a terceros por 12000.00 y una transferencia a su propia cuenta por 5000.00
- **THEN** `dailyLimit.used` es `"12000.00"` y `dailyLimit.remaining` es `"38000.00"`

#### Scenario: Hora de reinicio
- **WHEN** el usuario consulta a las 17:00 del 2026-10-13 en `America/Mexico_City`
- **THEN** `dailyLimit.resetsAt` es `2026-10-14T06:00:00Z`
- **AND** `dailyLimit.timeZone` es `America/Mexico_City`

### Requirement: ACC-12 Detalle de una cuenta propia
La API SHALL responder `GET /accounts/{accountId}` (`getAccount`) con la cuenta solicitada solo si pertenece al usuario autenticado, conforme a ACC-06. Si la cuenta no existe, es de otro usuario o es la cuenta SYSTEM, la API MUST responder 404 con `code` `NOT_FOUND` y el mismo cuerpo en todos esos casos.

#### Scenario: Cuenta propia
- **WHEN** el usuario consulta una de sus cuentas
- **THEN** la API responde 200 con su `id`, `name`, `clabe`, `balance` y `currency`

#### Scenario: Cuenta ajena
- **WHEN** el usuario consulta el `id` de una cuenta de otro usuario
- **THEN** la API responde 404 con `code` `NOT_FOUND`, igual que para un `id` inexistente

### Requirement: ACC-13 Saldo disponible igual al saldo contable
El sistema SHALL calcular el saldo disponible como el saldo contable de la cuenta, sin retenciones. Una transferencia en `PENDING_OTP` MUST NOT modificar el saldo de ninguna cuenta.

#### Scenario: Transferencia pendiente de OTP
- **WHEN** el usuario con saldo 30000.00 crea una transferencia de 15000.00 que queda en `PENDING_OTP`
- **THEN** `GET /accounts` sigue mostrando un saldo de `"30000.00"` en la cuenta de origen

### Requirement: ACC-14 Conciliación entre saldos y asientos
El sistema SHALL mantener en todo momento que el saldo de cada cuenta es igual a la suma de sus asientos en el ledger, que la suma de todos los asientos del sistema es cero y que el saldo de la cuenta SYSTEM es igual al negativo de la suma de los saldos de las cuentas USER.

#### Scenario: Conciliación después de operar
- **WHEN** se ejecuta el seed completo y después un conjunto de transferencias completadas y rechazadas
- **THEN** para cada cuenta, su saldo coincide con la suma de sus asientos
- **AND** la suma global de asientos es 0
- **AND** el saldo de la Tesorería es el negativo de la suma de los saldos de las cuentas USER

### Requirement: ACC-15 Fondeo desde la Tesorería
El sistema SHALL permitir que entre dinero a una cuenta USER únicamente mediante una transferencia de tipo fondeo desde la cuenta SYSTEM "Tesorería", ejecutada por el seed o por el script `db:fund`. Cada fondeo MUST generar dos asientos que suman cero (Tesorería en negativo, cuenta destino en positivo), aparecer en el historial del destino como movimiento `DEPOSIT` y registrar el evento de auditoría `FUNDING_POSTED` con actor `SYSTEM`. La API MUST NOT exponer ningún endpoint HTTP que cree dinero.

#### Scenario: Fondeo con el script
- **WHEN** se ejecuta `db:fund` para una cuenta con un monto de 1000.00
- **THEN** el saldo de la cuenta aumenta en 1000.00 y el de la Tesorería disminuye en 1000.00
- **AND** el historial de la cuenta muestra un movimiento `DEPOSIT` de `"1000.00"`
- **AND** existe un evento `FUNDING_POSTED` con actor `SYSTEM`

#### Scenario: Monto de fondeo inválido
- **WHEN** se ejecuta `db:fund` con un monto con más de 2 decimales o menor o igual a cero
- **THEN** el script termina con error y no se escribe ningún asiento

### Requirement: ACC-16 La Tesorería no participa en operaciones de usuario
La cuenta SYSTEM MUST NOT poder usarse como origen ni como destino de transferencias creadas por usuarios, ni registrarse como beneficiario, ni aparecer en respuestas de cuentas.

#### Scenario: Transferencia hacia la Tesorería
- **WHEN** un usuario envía una transferencia con `destination.type` `OWN_ACCOUNT` y el `id` de la Tesorería
- **THEN** la API responde 404 con `code` `NOT_FOUND`
