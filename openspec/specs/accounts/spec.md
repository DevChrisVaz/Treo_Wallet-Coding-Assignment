# accounts Specification

## Purpose

Define las cuentas de la billetera: cuentas de usuario y la cuenta de sistema "Tesorería", su apertura, la CLABE que identifica a cada cuenta de usuario y las garantías que la base de datos impone sobre ellas.

## Requirements

### Requirement: ACC-01 Cuentas de usuario y cuenta de sistema
El sistema SHALL distinguir dos tipos de cuenta: `USER`, que pertenece exactamente a un usuario, y `SYSTEM`, que no pertenece a ningún usuario. MUST existir exactamente una cuenta `SYSTEM` llamada "Tesorería", creada por las migraciones y no por un endpoint. La base de datos MUST garantizar que una cuenta `USER` siempre tiene dueño y que una cuenta `SYSTEM` nunca lo tiene.

#### Scenario: Tesorería creada por migraciones
- **WHEN** se aplican las migraciones sobre una base vacía
- **THEN** existe exactamente una cuenta `SYSTEM` llamada "Tesorería" sin dueño

#### Scenario: Cuenta de usuario sin dueño
- **WHEN** se intenta insertar una cuenta `USER` sin dueño directamente en la base
- **THEN** la base de datos rechaza la inserción

### Requirement: ACC-02 Saldo no negativo garantizado por la base
Cada cuenta SHALL tener un saldo en centavos, entero, que empieza en 0. La base de datos MUST rechazar cualquier escritura que deje negativo el saldo de una cuenta `USER`; solo la cuenta `SYSTEM` MUST poder tener saldo negativo, porque su negativo representa el dinero emitido hacia las cuentas de usuario.

#### Scenario: Saldo negativo en una cuenta de usuario
- **WHEN** se intenta actualizar directamente en la base el saldo de una cuenta `USER` a -1 centavo
- **THEN** la base de datos rechaza la escritura

#### Scenario: Saldo negativo en la Tesorería
- **WHEN** se actualiza el saldo de la Tesorería a un valor negativo
- **THEN** la base de datos acepta la escritura

### Requirement: ACC-03 CLABE de las cuentas de usuario
Cada cuenta `USER` SHALL tener una CLABE de 18 dígitos formada por el código de banco configurado, un código de plaza fijo, un número de cuenta de 11 dígitos tomado de una secuencia de la base y el dígito verificador calculado con los pesos 3, 7 y 1. El código de banco MUST ser ficticio, es decir, no corresponder a ningún banco real, y MUST venir de la configuración. La CLABE MUST ser única en todo el sistema, y la base de datos MUST garantizar que las cuentas `USER` tienen CLABE y la cuenta `SYSTEM` no la tiene.

#### Scenario: CLABE generada para una cuenta nueva
- **WHEN** se abre una cuenta de usuario
- **THEN** su CLABE tiene 18 dígitos, empieza con el código de banco configurado y su último dígito es el dígito verificador correcto

#### Scenario: CLABE única
- **WHEN** se abren dos cuentas de usuario
- **THEN** sus CLABE son distintas

#### Scenario: La Tesorería no tiene CLABE
- **WHEN** se consulta la cuenta `SYSTEM`
- **THEN** su CLABE es nula

### Requirement: ACC-04 Apertura de cuentas al verificar el correo
Al verificar su correo (IDN-06), el usuario SHALL recibir exactamente dos cuentas `USER`, "Principal" y "Ahorro", con saldo 0.00, abiertas en la misma transacción que la verificación. Un usuario sin verificar MUST NOT tener cuentas, y el nombre de cada cuenta MUST ser único entre las cuentas de su dueño, de modo que ninguna repetición de la verificación pueda abrir cuentas adicionales.

#### Scenario: Cuentas abiertas al verificar
- **WHEN** un usuario verifica su correo
- **THEN** tiene exactamente dos cuentas, "Principal" y "Ahorro", con saldo 0

#### Scenario: Usuario sin verificar
- **WHEN** un usuario se registra y aún no verifica su correo
- **THEN** no tiene ninguna cuenta

#### Scenario: Verificación repetida
- **WHEN** se intenta verificar de nuevo a un usuario ya verificado
- **THEN** el usuario sigue teniendo exactamente dos cuentas

### Requirement: ACC-05 Dígito verificador de la CLABE validado en la base
La base de datos SHALL ofrecer una validación de CLABE que acepte solo cadenas de exactamente 18 dígitos cuyo último dígito sea el verificador correcto: la suma de cada uno de los primeros 17 dígitos multiplicado por su peso (3, 7, 1 repetidos), tomando cada producto módulo 10; el verificador es 10 menos esa suma módulo 10, y 0 cuando el resultado es 10. Toda columna que guarde una CLABE MUST usar esa validación en una constraint de verificación, y la validación de la base y la de la aplicación MUST probarse con los mismos vectores.

#### Scenario: Vector conocido válido
- **WHEN** se valida la CLABE `032180000118359719`
- **THEN** la validación la acepta

#### Scenario: Dígito verificador incorrecto
- **WHEN** se intenta guardar la CLABE `032180000118359718`
- **THEN** la base de datos rechaza la escritura

#### Scenario: Suma múltiplo de 10
- **WHEN** se valida una CLABE cuyos primeros 17 dígitos producen una suma ponderada múltiplo de 10
- **THEN** la validación acepta el dígito verificador 0 y rechaza cualquier otro

#### Scenario: Ceros a la izquierda conservados
- **WHEN** se guarda una CLABE que empieza con `0`
- **THEN** al leerla conserva sus 18 caracteres, incluido el cero inicial

### Requirement: ACC-06 Propiedad de las cuentas
Cada cuenta `USER` SHALL estar ligada a su dueño por una llave foránea, y toda consulta que la API haga sobre cuentas en nombre de un usuario MUST filtrar por ese dueño. Una cuenta que no existe y una cuenta de otro usuario MUST producir la misma respuesta `404 NOT_FOUND`.

#### Scenario: Cuenta de otro usuario
- **WHEN** un usuario solicita una cuenta que pertenece a otro usuario
- **THEN** la API responde `404 NOT_FOUND`, igual que con un id inexistente

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
