## ADDED Requirements

### Requirement: TRF-27 Programación de una transferencia
La API SHALL aceptar en `POST /transfers` el campo opcional `scheduledFor`, una fecha calendario de `America/Mexico_City` entre el día siguiente a hoy y 90 días después de hoy, ambos inclusive. Con `scheduledFor` y un monto de hasta 10000.00, la API MUST responder 201 con `status` `SCHEDULED` y `scheduledFor`, sin crear asientos ni modificar saldos ni el límite diario.

Validación:
- Una fecha fuera de rango MUST responder 422 `VALIDATION_FAILED` con el error en `/scheduledFor` y el código `DATE_OUT_OF_RANGE`, incluida la fecha de hoy.
- Una fecha que no existe MUST responder lo mismo con `INVALID_DATE`.
- Las validaciones de propiedad, misma cuenta, monto, concepto y referencia (TRF-06 a TRF-09) MUST aplicar igual que en una transferencia inmediata.
- Al programar, la API MUST NOT validar el saldo ni el límite del día actual. La única excepción: una transferencia a un tercero con un monto mayor al límite diario MUST responder 422 `VALIDATION_FAILED` con el error en `/amount` y el código `TOO_LARGE`, porque nunca podría ejecutarse.

Amplía TRF-01.

#### Scenario: Programar para mañana
- **WHEN** el 14 de octubre de 2026 Ana programa 1000.00 a Luis para el `2026-10-15`
- **THEN** la API responde 201 con `status` `SCHEDULED` y `scheduledFor` `"2026-10-15"`
- **AND** su saldo y su límite diario no cambian

#### Scenario: Fecha de hoy
- **WHEN** el 14 de octubre de 2026 Ana programa una transferencia para el `2026-10-14`
- **THEN** la API responde 422 `VALIDATION_FAILED` con el error en `/scheduledFor` y el código `DATE_OUT_OF_RANGE`

#### Scenario: Más de 90 días
- **WHEN** el 14 de octubre de 2026 Ana programa una transferencia para el `2027-01-13`
- **THEN** la API responde 422 `VALIDATION_FAILED` con el código `DATE_OUT_OF_RANGE`

#### Scenario: Sin saldo suficiente hoy
- **WHEN** Ana, con saldo 100.00, programa 1000.00 a Luis para mañana
- **THEN** la API responde 201 con `status` `SCHEDULED`

#### Scenario: Monto mayor al límite diario
- **WHEN** Ana programa 50000.01 a un tercero
- **THEN** la API responde 422 `VALIDATION_FAILED` con el error en `/amount` y el código `TOO_LARGE`

#### Scenario: Programar entre cuentas propias
- **WHEN** Ana programa 5000.00 de "Principal" a "Ahorro" para el `2026-10-20`
- **THEN** la API responde 201 con `status` `SCHEDULED` y `kind` `OWN`

### Requirement: TRF-28 Programación con OTP
Cuando el monto de una transferencia programada es mayor a 10000.00, la API SHALL crearla en `PENDING_OTP` con su `scheduledFor`, con las mismas reglas de envío, intentos, vencimiento y reenvío del código (TRF-14, TRF-15, TRF-17, TRF-19 y TRF-20). El correo MUST incluir la fecha programada.

Al confirmarla con el código correcto, la API MUST:
- pasarla a `SCHEDULED` y responder 200, sin mover dinero ni revalidar el saldo o el límite;
- responder 200 sin consumir intentos si se vuelve a confirmar una transferencia que ya está en `SCHEDULED`.

Una transferencia programada que no se confirma a tiempo MUST quedar `EXPIRED` y nunca ejecutarse. Amplía TRF-14, TRF-16 y TRF-18.

#### Scenario: Programada mayor al umbral
- **WHEN** Ana programa 15000.00 a Luis para el `2026-10-20`
- **THEN** la API responde 201 con `status` `PENDING_OTP` y `scheduledFor` `"2026-10-20"`
- **AND** el correo con el código menciona el 20 de octubre de 2026

#### Scenario: Confirmación de una programada
- **WHEN** Ana confirma esa transferencia con el código correcto
- **THEN** la API responde 200 con `status` `SCHEDULED`
- **AND** su saldo y su límite diario no cambian

#### Scenario: Doble confirmación
- **WHEN** Ana confirma otra vez una transferencia que ya está en `SCHEDULED`
- **THEN** la API responde 200 con `status` `SCHEDULED` sin consumir intentos

#### Scenario: Confirmación después de medianoche
- **WHEN** una transferencia programada para el `2026-10-15` se crea a las 23:58 del 14 de octubre en la Ciudad de México y se confirma a las 00:02 del 15
- **THEN** queda en `SCHEDULED` y se ejecuta en la siguiente pasada del proceso de ejecución

#### Scenario: Programada sin confirmar
- **WHEN** pasan 5 minutos sin confirmar una transferencia programada en `PENDING_OTP`
- **THEN** `GET /transfers/{transferId}` muestra `status` `EXPIRED`
- **AND** nunca se ejecuta

### Requirement: TRF-29 Idempotencia y tope de programadas
Las reglas de idempotencia de TRF-02 a TRF-05 SHALL aplicar a las transferencias programadas, y `scheduledFor` MUST formar parte del contenido que se compara. Reutilizar una llave con otra fecha, o con fecha cuando la original no la tenía, MUST responder 422 `IDEMPOTENCY_KEY_REUSED`. La huella de las transferencias inmediatas existentes MUST NOT cambiar.

Cada usuario SHALL tener como máximo 20 transferencias programadas activas, contando las que están en `SCHEDULED` y las programadas en `PENDING_OTP` vigentes. Crear una más MUST responder 422 `SCHEDULED_LIMIT_REACHED` sin guardar la transferencia ni consumir la llave. El tope MUST respetarse aunque lleguen peticiones simultáneas con llaves distintas.

#### Scenario: Reintento de una programación
- **WHEN** el cliente reenvía la misma programación con la misma llave
- **THEN** la API responde 200 con la misma transferencia, `status` `SCHEDULED` e `Idempotent-Replayed: true`

#### Scenario: Misma llave con otra fecha
- **WHEN** se reutiliza la llave de una programación para el `2026-10-15` con `scheduledFor` `2026-10-16`
- **THEN** la API responde 422 `IDEMPOTENCY_KEY_REUSED`

#### Scenario: Huella de las inmediatas
- **WHEN** se reintenta con la misma llave una transferencia inmediata creada antes de este cambio
- **THEN** la API la reconoce como reintento y responde 200 con la transferencia original

#### Scenario: Programada número 21
- **WHEN** Ana tiene 20 transferencias en `SCHEDULED` y programa otra
- **THEN** la API responde 422 `SCHEDULED_LIMIT_REACHED` y no se guarda ninguna transferencia nueva

#### Scenario: Dos programaciones simultáneas en el tope
- **WHEN** Ana tiene 19 programadas activas y envía al mismo tiempo dos programaciones con llaves distintas
- **THEN** exactamente una responde 201 y la otra 422 `SCHEDULED_LIMIT_REACHED`

### Requirement: TRF-30 Ejecución en la fecha programada
A partir de las 00:00 de `America/Mexico_City` del día `scheduledFor`, el sistema SHALL ejecutar cada transferencia en `SCHEDULED`, sin intervención del usuario y sin OTP. Las ejecuta en orden de `scheduledFor` y luego de creación.

La ejecución MUST:
- validar bajo bloqueo el saldo y, para terceros, el límite diario del día en que se ejecuta, igual que una transferencia inmediata;
- si las validaciones pasan, completarla con sus dos asientos, con `completedAt` igual a la hora de ejecución, y consumir el límite del día de ejecución;
- si no pasan, marcarla `FAILED` con `failureReason` `INSUFFICIENT_FUNDS` o `DAILY_LIMIT_EXCEEDED` y sin asientos.

Una transferencia cuya fecha ya pasó porque el proceso no estuvo disponible MUST ejecutarse en la siguiente pasada. Amplía TRF-11 y TRF-12.

#### Scenario: Ejecución a medianoche
- **WHEN** una transferencia de 1000.00 a Luis está programada para el `2026-10-15` y el proceso corre a las 00:00:30 del 15 en la Ciudad de México
- **THEN** la transferencia queda `COMPLETED` con dos asientos
- **AND** el historial de Ana muestra un `TRANSFER_OUT` del 15 de octubre

#### Scenario: Antes de su fecha
- **WHEN** el proceso corre a las 23:59 del 14 de octubre en la Ciudad de México
- **THEN** la transferencia programada para el `2026-10-15` sigue en `SCHEDULED`

#### Scenario: Saldo insuficiente al ejecutar
- **WHEN** al ejecutarse una programada de 1000.00, la cuenta de origen tiene 500.00
- **THEN** queda `FAILED` con `failureReason` `INSUFFICIENT_FUNDS`, sin asientos, y el saldo sigue en 500.00

#### Scenario: Límite del día de ejecución
- **WHEN** el día de ejecución Ana ya transfirió 45000.00 a terceros y vence una programada de 6000.00 a un tercero
- **THEN** queda `FAILED` con `failureReason` `DAILY_LIMIT_EXCEEDED`

#### Scenario: Límite diario que cruza medianoche
- **WHEN** Ana agotó el límite del 14 de octubre y una programada de 1000.00 a un tercero para el 15 se ejecuta a las 00:00:30 del 15
- **THEN** se completa y consume el límite del 15, no el del 14

#### Scenario: Ejecución atrasada
- **WHEN** el proceso no corrió entre las 00:00 y las 09:00 del 15 de octubre y corre a las 09:00
- **THEN** ejecuta la programada del 15 a las 09:00 y consume el límite del 15

### Requirement: TRF-31 Ejecución única ante concurrencia
El sistema SHALL ejecutar cada transferencia programada exactamente una vez, aunque varios procesos de ejecución (por ejemplo, una instancia de la API por tarea) corran al mismo tiempo. La ejecución MUST seguir el orden global de bloqueos (contador del límite del usuario, luego la transferencia, luego las cuentas por id). Así, ejecutar programadas al mismo tiempo que el usuario hace transferencias manuales MUST NOT perder ni duplicar dinero ni producir deadlocks.

#### Scenario: Dos procesos de ejecución
- **WHEN** dos procesos de ejecución corren al mismo tiempo sobre 50 transferencias programadas vencidas
- **THEN** cada una queda `COMPLETED` o `FAILED` una sola vez y las completadas tienen exactamente dos asientos
- **AND** las consultas de conciliación del ledger devuelven cero diferencias

#### Scenario: Ejecución y transferencia manual
- **WHEN** mientras se ejecutan programadas desde una cuenta, el usuario envía transferencias manuales desde la misma cuenta
- **THEN** ninguna operación falla por deadlock y el saldo final concilia con los asientos

### Requirement: TRF-32 Cancelación de una programada
La API SHALL cancelar una transferencia del usuario en `SCHEDULED` mediante `POST /transfers/{transferId}/cancel` (`cancelTransfer`): la pasa a `CANCELLED` con `cancelledAt` y responde 200. Una cancelada nunca se ejecuta.

La API MUST responder:
- 200 al cancelar una transferencia que ya está `CANCELLED`, sin cambiarla;
- 409 `TRANSFER_NOT_CANCELLABLE` con `transferStatus` si la transferencia está en cualquier otro estado;
- 404 `NOT_FOUND` si la transferencia es de otro usuario.

Si la cancelación y la ejecución coinciden, MUST ganar exactamente una: o la transferencia queda `CANCELLED` sin asientos, o se ejecuta y la cancelación responde 409.

#### Scenario: Cancelar una programada
- **WHEN** Ana cancela una transferencia en `SCHEDULED`
- **THEN** la API responde 200 con `status` `CANCELLED` y `cancelledAt`
- **AND** el proceso de ejecución no la ejecuta en su fecha

#### Scenario: Doble cancelación
- **WHEN** Ana cancela otra vez la misma transferencia
- **THEN** la API responde 200 con `status` `CANCELLED`

#### Scenario: Cancelar una ya ejecutada
- **WHEN** Ana intenta cancelar una programada que ya quedó `COMPLETED`
- **THEN** la API responde 409 `TRANSFER_NOT_CANCELLABLE` con `transferStatus` `COMPLETED`

#### Scenario: Cancelar una transferencia ajena
- **WHEN** Ana intenta cancelar una programada de Luis
- **THEN** la API responde 404 `NOT_FOUND`

#### Scenario: Cancelación y ejecución al mismo tiempo
- **WHEN** Ana cancela una programada vencida en el mismo momento en que el proceso de ejecución la toma
- **THEN** la transferencia termina `CANCELLED` sin asientos o `COMPLETED` con dos asientos, nunca ambas cosas
- **AND** si terminó `COMPLETED`, la cancelación respondió 409 `TRANSFER_NOT_CANCELLABLE`

### Requirement: TRF-33 Consulta de las programadas
La API SHALL responder `GET /transfers/scheduled` (`listScheduledTransfers`) con las transferencias del usuario autenticado en `SCHEDULED`, ordenadas por `scheduledFor` y luego por fecha de creación, ambas ascendentes. Cada transferencia lleva el destino con nombre y últimos 4 dígitos de la CLABE, el monto, el concepto, la referencia y `scheduledFor`. Las ejecutadas, fallidas, canceladas, vencidas y las que esperan su OTP MUST NOT aparecer.

#### Scenario: Programadas en orden
- **WHEN** Ana tiene programadas para el 20, el 15 y el 15 de octubre (esta última creada después)
- **THEN** la lista las devuelve en el orden 15 (la primera creada), 15 y 20

#### Scenario: Después de cancelar o ejecutar
- **WHEN** una programada se cancela y otra se ejecuta
- **THEN** ninguna de las dos aparece en la lista

#### Scenario: Programadas de otro usuario
- **WHEN** Luis consulta sus programadas
- **THEN** la lista no contiene ninguna transferencia de Ana

### Requirement: TRF-34 Estados de las programadas
Las transferencias en `SCHEDULED` o `CANCELLED` MUST NOT tener asientos, aparecer en el historial (amplía HIS-02) ni consumir límite diario (amplía TRF-11). `GET /transfers/{transferId}` SHALL mostrar `scheduledFor` en toda transferencia programada, sin importar su estado, y `cancelledAt` en las canceladas. La base de datos MUST impedir:
- una transferencia en `SCHEDULED` o `CANCELLED` sin `scheduledFor`;
- una fecha de cancelación en una transferencia que no está `CANCELLED`.

#### Scenario: Programada fuera del historial
- **WHEN** Ana programa 1000.00 a Luis para mañana
- **THEN** el historial de su cuenta no muestra ningún movimiento de esa transferencia

#### Scenario: Comprobante de una programada ejecutada
- **WHEN** Ana consulta una programada que se ejecutó
- **THEN** la respuesta tiene `status` `COMPLETED`, `scheduledFor` y `completedAt`

#### Scenario: Estado inválido en la base
- **WHEN** una sentencia intenta guardar una transferencia `SCHEDULED` sin `scheduled_for`
- **THEN** PostgreSQL la rechaza por una constraint con nombre

### Requirement: TRF-35 Aviso de falla de una programada
Cuando una transferencia programada queda `FAILED` al ejecutarse, el sistema SHALL enviar al correo verificado del usuario un aviso con el monto, el nombre del destino, los últimos 4 dígitos de su CLABE, la fecha programada y el motivo en lenguaje claro. El correo MUST enviarse después de confirmar la transacción. Si su envío falla, MUST registrarse en los logs sin revertir el estado `FAILED` y sin repetir la ejecución.

#### Scenario: Aviso por saldo insuficiente
- **WHEN** una programada de 1000.00 a Luis falla por saldo insuficiente
- **THEN** el buzón de Ana recibe un correo con "$1,000.00", "Luis", los últimos 4 dígitos de su CLABE, la fecha programada y "saldo insuficiente"

#### Scenario: Falla el envío del aviso
- **WHEN** el servidor de correo no está disponible al fallar una programada
- **THEN** la transferencia queda `FAILED` y la siguiente pasada no la vuelve a ejecutar

### Requirement: TRF-36 Auditoría de las programadas
El sistema SHALL registrar, en la misma transacción de cada operación:
- `TRANSFER_CREATED` con el estado inicial al programar;
- `TRANSFER_SCHEDULED` cuando la transferencia queda en `SCHEDULED`, sea al crearla o al confirmar su OTP;
- `TRANSFER_CANCELLED` con actor `USER` al cancelar;
- `TRANSFER_COMPLETED` o `TRANSFER_FAILED` con actor `SYSTEM` al ejecutar.

Los eventos llevan el `transferId`, el monto, la fecha programada y el motivo cuando aplique, sin datos personales. Si el evento no puede registrarse, la operación MUST revertirse y una ejecución revertida MUST quedar en `SCHEDULED` para la siguiente pasada. Amplía TRF-25.

#### Scenario: Ejecución auditada
- **WHEN** el proceso ejecuta una programada
- **THEN** existe un evento `TRANSFER_COMPLETED` con actor `SYSTEM`, el `transferId`, el monto y la fecha programada

#### Scenario: Falla la auditoría al ejecutar
- **WHEN** el registro del evento falla durante la ejecución de una programada
- **THEN** la transferencia sigue en `SCHEDULED`, sin asientos, y se ejecuta en la siguiente pasada
