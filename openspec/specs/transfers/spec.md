# transfers Specification

## Purpose

Mover dinero entre cuentas de la plataforma de forma que el dinero siempre cuadre: transferencias idempotentes hacia una cuenta propia o un beneficiario, con confirmación por OTP sobre un umbral, límite diario por usuario, ledger de partida doble y comportamiento correcto ante concurrencia, reintentos y pérdidas de red.

## Requirements

### Requirement: TRF-01 Creación de una transferencia
La API SHALL crear una transferencia mediante `POST /transfers` (`createTransfer`) desde una cuenta del usuario autenticado hacia otra cuenta propia (`destination.type` `OWN_ACCOUNT`) o hacia un beneficiario registrado (`destination.type` `BENEFICIARY`), con `amount`, `concept` y `reference`. Cuando el monto es menor o igual a 10000.00 y las validaciones de negocio se cumplen, la API MUST ejecutarla de inmediato y responder 201 con `status` `COMPLETED` y `completedAt`.

#### Scenario: Transferencia a un beneficiario
- **WHEN** Ana, con saldo 5000.00, envía 1250.50 a su beneficiario Luis con concepto "Renta" y referencia "1234567"
- **THEN** la API responde 201 con `status` `COMPLETED`, `kind` `THIRD_PARTY` y `amount` `"1250.50"`
- **AND** el saldo de Ana baja a 3749.50 y el de Luis sube en 1250.50

#### Scenario: Transferencia a otra cuenta propia
- **WHEN** Ana envía 500.00 de "Principal" a "Ahorro"
- **THEN** la API responde 201 con `status` `COMPLETED` y `kind` `OWN`

### Requirement: TRF-02 Llave de idempotencia obligatoria
La API SHALL exigir el header `Idempotency-Key` con un UUID en `POST /transfers`. Si falta, MUST responder 400 con `code` `IDEMPOTENCY_KEY_MISSING`; si no es un UUID, 400 con `code` `IDEMPOTENCY_KEY_INVALID`. Una petición rechazada por formato o validación de esquema MUST NOT consumir la llave.

#### Scenario: Sin llave
- **WHEN** se envía una transferencia sin el header `Idempotency-Key`
- **THEN** la API responde 400 con `code` `IDEMPOTENCY_KEY_MISSING` y no se crea ninguna transferencia

#### Scenario: La validación no consume la llave
- **WHEN** una petición con la llave K falla con 422 `VALIDATION_FAILED` y luego se reenvía con la misma llave K y un payload válido
- **THEN** la segunda petición crea la transferencia normalmente

### Requirement: TRF-03 Reintento con la misma llave devuelve el estado real
Cuando llega una petición con una llave ya usada por el mismo usuario y el mismo contenido, la API SHALL responder 200 con el estado **actual** de la transferencia original y el header `Idempotent-Replayed: true`, sin crear otra transferencia ni mover dinero otra vez. Si la transferencia original fue rechazada, MUST responder el mismo 422 con su `transferId`.

#### Scenario: Doble clic en Enviar
- **WHEN** el cliente envía dos veces la misma transferencia con la misma llave
- **THEN** existe una sola transferencia y el saldo se descuenta una sola vez
- **AND** la segunda respuesta es 200 con el mismo `id` y `Idempotent-Replayed: true`

#### Scenario: Pérdida de red a mitad de una transferencia en móvil
- **WHEN** la transferencia se completó pero la respuesta no llegó al móvil, y la app reintenta con la misma llave
- **THEN** la API responde 200 con `status` `COMPLETED` y el mismo `id`, sin descontar dos veces

#### Scenario: Reintento después de confirmar el OTP
- **WHEN** una transferencia creada en `PENDING_OTP` ya fue confirmada y el cliente reintenta la creación con la misma llave
- **THEN** la API responde 200 con `status` `COMPLETED`

#### Scenario: Reintento de una transferencia rechazada
- **WHEN** una transferencia fue rechazada por saldo insuficiente, después entra dinero a la cuenta y el cliente reintenta con la misma llave
- **THEN** la API responde el mismo 422 `INSUFFICIENT_FUNDS` con el mismo `transferId` y no ejecuta la transferencia

### Requirement: TRF-04 Llave reutilizada con otro contenido
La API SHALL comparar el contenido de una petición con el de la original usando los valores ya interpretados (cuenta de origen, destino, monto en centavos, concepto y referencia) y MUST responder 422 con `code` `IDEMPOTENCY_KEY_REUSED` si difieren. Dos representaciones del mismo monto (`"100.5"` y `"100.50"`) MUST considerarse el mismo contenido.

#### Scenario: Misma llave con otro monto
- **WHEN** se reutiliza la llave K de una transferencia de 100.00 para enviar 200.00
- **THEN** la API responde 422 con `code` `IDEMPOTENCY_KEY_REUSED` y no se mueve dinero

#### Scenario: Mismo monto escrito distinto
- **WHEN** la petición original llevó `"100.5"` y el reintento lleva `"100.50"` con la misma llave
- **THEN** la API lo trata como reintento y responde 200 con la transferencia original

### Requirement: TRF-05 Peticiones simultáneas con la misma llave
La API SHALL garantizar que peticiones concurrentes con la misma llave y el mismo usuario produzcan exactamente una transferencia, y que todas reciban una respuesta con el mismo `id`.

#### Scenario: Diez peticiones simultáneas
- **WHEN** se envían 10 peticiones simultáneas idénticas con la misma llave
- **THEN** existe exactamente una transferencia con esa llave y dos asientos
- **AND** las 10 respuestas tienen el mismo `id` de transferencia

### Requirement: TRF-06 Propiedad de las cuentas y del beneficiario
La API SHALL verificar que la cuenta de origen, la cuenta propia de destino o el beneficiario de destino pertenezcan al usuario autenticado, y MUST responder 404 con `code` `NOT_FOUND` si alguno no existe o es de otro usuario, con la misma respuesta en ambos casos. La verificación MUST ocurrir de forma atómica con el bloqueo de las cuentas. El tipo de transferencia (`OWN` o `THIRD_PARTY`) MUST derivarse en el servidor, nunca del cliente.

#### Scenario: Origen ajeno
- **WHEN** Ana envía una transferencia con `fromAccountId` igual a una cuenta de Luis
- **THEN** la API responde 404 `NOT_FOUND` y el saldo de Luis no cambia

#### Scenario: Destino propio que es ajeno
- **WHEN** Ana usa `destination.type` `OWN_ACCOUNT` con el `accountId` de una cuenta de Luis
- **THEN** la API responde 404 `NOT_FOUND`

#### Scenario: Beneficiario de otro usuario
- **WHEN** Ana usa el `beneficiaryId` de un beneficiario registrado por Luis
- **THEN** la API responde 404 `NOT_FOUND`

### Requirement: TRF-07 Transferencia a la misma cuenta
La API SHALL rechazar con 422 y `code` `SAME_ACCOUNT_TRANSFER` una transferencia cuyo origen y destino son la misma cuenta, y la base de datos MUST impedirla también con una constraint `CHECK`.

#### Scenario: Transferencia a la propia cuenta
- **WHEN** Ana envía una transferencia de "Principal" con destino `OWN_ACCOUNT` igual a "Principal"
- **THEN** la API responde 422 con `code` `SAME_ACCOUNT_TRANSFER` y no se crea ninguna transferencia

### Requirement: TRF-08 Validación del monto sin redondeo
La API SHALL aceptar el monto solo como string decimal positivo con 0 a 2 decimales, sin ceros a la izquierda y con un máximo de 12 dígitos enteros, y MUST rechazar con 422 `VALIDATION_FAILED` cualquier otro valor en lugar de redondearlo. Los montos MUST manejarse en centavos enteros en todo el procesamiento.

#### Scenario: Más de dos decimales
- **WHEN** se envía `amount` `"100.005"`
- **THEN** la API responde 422 con `code` `VALIDATION_FAILED` y un error en `/amount`
- **AND** no se crea ninguna transferencia ni se redondea a 100.01 ni a 100.00

#### Scenario: Número JSON
- **WHEN** se envía `amount` como número JSON `1250.5`
- **THEN** la API responde 422 con `code` `VALIDATION_FAILED`

#### Scenario: Monto cero
- **WHEN** se envía `amount` `"0.00"`
- **THEN** la API responde 422 con `code` `VALIDATION_FAILED`

#### Scenario: Un decimal
- **WHEN** se envía `amount` `"1250.5"` y la transferencia se completa
- **THEN** se descuentan exactamente 125050 centavos y la respuesta muestra `"1250.50"`

### Requirement: TRF-09 Concepto y referencia
La API SHALL exigir `concept` de 1 a 40 caracteres sin espacios al inicio ni al final y aceptar `reference` como campo opcional: si viene, MUST ser un string de 1 a 7 dígitos; si falta o viene vacío, la transferencia queda sin referencia. Con un valor inválido MUST responder 422 `VALIDATION_FAILED`. Una transferencia sin referencia MUST devolver `reference` igual a `null` en la creación, en el comprobante y en el historial, y el sistema MUST NOT imprimir "null" ni "0" en correos ni en el estado de cuenta. Omitir la referencia y enviarla vacía MUST ser la misma petición para la idempotencia (TRF-02 a TRF-05).

#### Scenario: Referencia con letras
- **WHEN** se envía `reference` `"12A"`
- **THEN** la API responde 422 con `code` `VALIDATION_FAILED` y un error en `/reference`

#### Scenario: Sin referencia
- **WHEN** se crea una transferencia sin el campo `reference`
- **THEN** la API responde 201 con `reference` igual a `null`
- **AND** `GET /transfers/{transferId}` y el movimiento del historial también traen `reference` igual a `null`

#### Scenario: Referencia vacía
- **WHEN** se envía `reference` igual a `""`
- **THEN** la API la trata como una transferencia sin referencia

#### Scenario: Reintento con y sin referencia
- **WHEN** se reintenta con la misma llave una petición sin referencia, ahora con `reference` `""`
- **THEN** la API responde 200 con la misma transferencia
- **AND** si se reintenta con la referencia `"123"`, responde 422 `IDEMPOTENCY_KEY_REUSED`

### Requirement: TRF-10 Rechazo por saldo insuficiente
Cuando el saldo de la cuenta de origen, leído bajo bloqueo, es menor al monto, la API SHALL guardar la transferencia con `status` `REJECTED` y `rejectionReason` `INSUFFICIENT_FUNDS`, sin asientos, y responder 422 con `code` `INSUFFICIENT_FUNDS` y el `transferId`.

#### Scenario: Saldo insuficiente
- **WHEN** Ana, con saldo 100.00, envía 150.00
- **THEN** la API responde 422 con `code` `INSUFFICIENT_FUNDS` y `transferId`
- **AND** `GET /transfers/{transferId}` muestra `status` `REJECTED`
- **AND** el saldo de Ana sigue en 100.00

#### Scenario: Saldo exacto
- **WHEN** Ana, con saldo 100.00, envía 100.00
- **THEN** la transferencia se completa y su saldo queda en 0.00

### Requirement: TRF-11 Límite diario por usuario
La API SHALL limitar a 50000.00 MXN por usuario la suma de transferencias a terceros completadas en un día calendario de `America/Mexico_City`, permitiendo llegar exactamente al límite. Las transferencias entre cuentas propias, las rechazadas, las fallidas, las vencidas y las pendientes MUST NOT consumir límite. Si una transferencia lo excede, la API MUST guardarla como `REJECTED` con `rejectionReason` `DAILY_LIMIT_EXCEEDED` y responder 422 con `code` `DAILY_LIMIT_EXCEEDED`, el `transferId` y `remaining`.

#### Scenario: Llegar exactamente al límite
- **WHEN** el usuario ya transfirió hoy 40000.00 a terceros y envía 10000.00 a un tercero
- **THEN** la transferencia se completa y `dailyLimit.remaining` queda en `"0.00"`

#### Scenario: Exceder el límite
- **WHEN** el usuario ya transfirió hoy 45000.00 a terceros y envía 6000.00 a un tercero
- **THEN** la API responde 422 con `code` `DAILY_LIMIT_EXCEEDED` y `remaining` `"5000.00"`

#### Scenario: Cuentas propias no consumen límite
- **WHEN** el usuario ya transfirió hoy 50000.00 a terceros y envía 8000.00 entre sus cuentas
- **THEN** la transferencia se procesa sin rechazo por límite

### Requirement: TRF-12 Día del límite en la zona horaria de la Ciudad de México
El sistema SHALL asignar cada transferencia al día calendario de `America/Mexico_City` en que se completó, usando una hora tomada después de obtener los bloqueos. El límite MUST reiniciarse a la medianoche de `America/Mexico_City`, no a la medianoche UTC.

#### Scenario: Límite diario que cruza medianoche
- **WHEN** el usuario agota el límite con transferencias completadas a las 23:59 de un día en CDMX y envía 1000.00 a un tercero a las 00:01 del día siguiente en CDMX
- **THEN** la transferencia de las 00:01 se completa porque pertenece a un día nuevo

#### Scenario: La medianoche UTC no reinicia el límite
- **WHEN** el usuario agota el límite a las 17:00 en CDMX y vuelve a enviar a las 18:30 en CDMX (00:30 UTC del día siguiente)
- **THEN** la API responde 422 `DAILY_LIMIT_EXCEEDED`

#### Scenario: OTP creado antes de medianoche y confirmado después
- **WHEN** una transferencia de 30000.00 a un tercero se crea a las 23:58 en `PENDING_OTP` y se confirma a las 00:02 del día siguiente
- **THEN** consume el límite del día nuevo y no el del día anterior

### Requirement: TRF-13 Límite diario consistente ante concurrencia
El sistema SHALL garantizar el límite diario aunque el usuario envíe transferencias simultáneas desde cuentas distintas, serializando la verificación por usuario, y la base de datos MUST impedir con una constraint `CHECK` que el uso registrado del día supere el límite.

#### Scenario: Dos cuentas en paralelo
- **WHEN** el usuario tiene 40000.00 usados hoy y envía al mismo tiempo 8000.00 desde "Principal" y 8000.00 desde "Ahorro" a terceros
- **THEN** exactamente una se completa y la otra se rechaza con `DAILY_LIMIT_EXCEEDED`
- **AND** el uso del día queda en 48000.00

### Requirement: TRF-14 OTP para montos mayores al umbral
Cuando el monto es mayor a 10000.00, la API SHALL crear la transferencia en `status` `PENDING_OTP`, sin asientos y sin modificar saldos ni límite, enviar un código de un solo uso por correo y responder 201 con `requiresOtp` `true` y `otp` (`channel`, `deliveryStatus`, `maskedDestination`, `expiresAt`, `attemptsRemaining`, `resendsRemaining`). La regla MUST aplicar también a transferencias entre cuentas propias. Un monto de exactamente 10000.00 MUST NOT pedir OTP. Antes de crearla, la API MUST validar saldo y límite y rechazar de inmediato si no se cumplen.

#### Scenario: Monto mayor al umbral
- **WHEN** Ana envía 15000.00 a un beneficiario
- **THEN** la API responde 201 con `status` `PENDING_OTP` y `otp.attemptsRemaining` 3
- **AND** su saldo no cambia

#### Scenario: Exactamente el umbral
- **WHEN** Ana envía 10000.00 a un beneficiario
- **THEN** la API responde 201 con `status` `COMPLETED`

#### Scenario: Cuentas propias por encima del umbral
- **WHEN** Ana envía 12000.00 de "Principal" a "Ahorro"
- **THEN** la API responde 201 con `status` `PENDING_OTP`

### Requirement: TRF-15 Entrega del OTP por correo
El sistema SHALL enviar el código de 6 dígitos al correo verificado del usuario después de confirmar la transacción, incluyendo en el mensaje el monto, el nombre del destino y los últimos 4 dígitos de su CLABE. El código MUST NOT aparecer en la respuesta HTTP, en los logs ni en la auditoría, y MUST guardarse solo como hash. Si el envío falla, la API MUST responder igualmente 201 con `otp.deliveryStatus` `FAILED`.

#### Scenario: Correo con el detalle de la operación
- **WHEN** se crea una transferencia de 15000.00 a Luis
- **THEN** el buzón del usuario recibe un correo con el código, "$15,000.00", "Luis" y los últimos 4 dígitos de la CLABE
- **AND** ni la respuesta ni los logs contienen el código

#### Scenario: Falla el envío del correo
- **WHEN** el servidor de correo no está disponible al crear una transferencia que requiere OTP
- **THEN** la API responde 201 con `status` `PENDING_OTP` y `otp.deliveryStatus` `FAILED`

### Requirement: TRF-16 Confirmación con OTP
La API SHALL confirmar una transferencia en `PENDING_OTP` mediante `POST /transfers/{transferId}/confirm` (`confirmTransfer`) cuando el código es correcto y vigente, volviendo a validar bajo bloqueo el saldo y el límite diario antes de mover el dinero. Si la revalidación falla, MUST marcar la transferencia como `FAILED` con `failureReason` y responder 422 con el `code` correspondiente (`INSUFFICIENT_FUNDS` o `DAILY_LIMIT_EXCEEDED`).

#### Scenario: Confirmación exitosa
- **WHEN** el usuario confirma con el código correcto antes de que venza
- **THEN** la API responde 200 con `status` `COMPLETED` y los saldos se actualizan

#### Scenario: El saldo se gastó mientras esperaba el OTP
- **WHEN** una transferencia de 15000.00 está en `PENDING_OTP`, el usuario gasta su saldo en otra operación y luego confirma con el código correcto
- **THEN** la API responde 422 `INSUFFICIENT_FUNDS` y la transferencia queda `FAILED`

### Requirement: TRF-17 Intentos del OTP
La API SHALL permitir 3 intentos por código. Un código incorrecto MUST responder 422 con `code` `OTP_INVALID` y `attemptsRemaining`; el tercer código incorrecto MUST marcar la transferencia como `FAILED` con `failureReason` `OTP_ATTEMPTS_EXHAUSTED` y responder 422 con ese `code` y el `transferId`.

#### Scenario: Código incorrecto
- **WHEN** el usuario envía un código incorrecto por primera vez
- **THEN** la API responde 422 `OTP_INVALID` con `attemptsRemaining` 2

#### Scenario: Tercer intento fallido
- **WHEN** el usuario envía un código incorrecto por tercera vez
- **THEN** la API responde 422 `OTP_ATTEMPTS_EXHAUSTED` y la transferencia queda `FAILED`

### Requirement: TRF-18 Confirmación idempotente por estado
La API SHALL responder 200 con la transferencia, sin consumir un intento, cuando se confirma una transferencia que ya está `COMPLETED`. Si la transferencia está `REJECTED` o `FAILED`, MUST responder 409 con `code` `TRANSFER_NOT_PENDING` y `transferStatus`. Dos confirmaciones simultáneas MUST mover el dinero una sola vez.

#### Scenario: Doble clic en Confirmar
- **WHEN** el cliente envía dos confirmaciones simultáneas con el código correcto
- **THEN** la transferencia genera exactamente dos asientos y ambas respuestas son 200 con `status` `COMPLETED`

#### Scenario: Pérdida de red al confirmar
- **WHEN** la confirmación se completó pero la respuesta no llegó y la app reintenta
- **THEN** la API responde 200 con `status` `COMPLETED` sin consumir intentos

### Requirement: TRF-19 Vencimiento del OTP
Una transferencia en `PENDING_OTP` SHALL considerarse `EXPIRED` cinco minutos después de su creación o de su último reenvío, sin necesidad de un proceso en segundo plano. Confirmar una transferencia vencida MUST responder 409 con `code` `TRANSFER_EXPIRED`, y su consulta MUST mostrar `status` `EXPIRED`.

#### Scenario: Confirmar después de cinco minutos
- **WHEN** el usuario confirma con el código correcto 6 minutos después de crear la transferencia
- **THEN** la API responde 409 `TRANSFER_EXPIRED` y no se mueve dinero
- **AND** `GET /transfers/{transferId}` muestra `status` `EXPIRED`

### Requirement: TRF-20 Reenvío del OTP
La API SHALL reenviar el código de una transferencia en `PENDING_OTP` mediante `POST /transfers/{transferId}/otp/resend` (`resendTransferOtp`), hasta 3 veces. Cada reenvío MUST invalidar el código anterior, reiniciar los intentos y la vigencia, y responder 202 con el nuevo `OtpChallenge`. El cuarto reenvío MUST responder 422 `RESEND_LIMIT_REACHED`, y reenviar para una transferencia que no está pendiente o ya venció MUST responder 409.

#### Scenario: El código anterior deja de servir
- **WHEN** el usuario pide un reenvío y luego confirma con el código anterior
- **THEN** la API responde 422 `OTP_INVALID`

#### Scenario: Cuarto reenvío
- **WHEN** el usuario pide un cuarto reenvío
- **THEN** la API responde 422 `RESEND_LIMIT_REACHED`

### Requirement: TRF-21 Partida doble
Cada transferencia completada SHALL generar exactamente dos asientos en el ledger, uno negativo en la cuenta de origen y uno positivo en la de destino, que suman cero. La base de datos MUST rechazar al confirmar la transacción cualquier transferencia cuyos asientos no sumen cero. Las transferencias `PENDING_OTP`, `REJECTED`, `FAILED` y `EXPIRED` MUST NOT tener asientos.

#### Scenario: Asientos de una transferencia completada
- **WHEN** se completa una transferencia de 1250.50
- **THEN** existen dos asientos de -125050 y +125050 centavos con el mismo `transferId`

#### Scenario: Asientos desbalanceados
- **WHEN** una transacción intenta registrar para una transferencia asientos que suman distinto de cero
- **THEN** PostgreSQL rechaza el commit y no queda ningún cambio

### Requirement: TRF-22 Saldos y saldo posterior en la misma transacción
El sistema SHALL actualizar los saldos de las cuentas y registrar en cada asiento el saldo resultante (`balance_after`) en la misma transacción que crea los asientos, de modo que para cada cuenta el `balance_after` de un asiento sea el del asiento anterior más su monto.

#### Scenario: Cadena de saldos posteriores
- **WHEN** una cuenta recibe un depósito de 1000.00 y después envía 200.00 y 300.00
- **THEN** sus `balance_after` son 1000.00, 800.00 y 500.00, y su saldo es 500.00

### Requirement: TRF-23 Asientos inmutables
El rol de base de datos de la aplicación MUST NOT tener permisos de `UPDATE`, `DELETE` ni `TRUNCATE` sobre los asientos del ledger, y un trigger SHALL rechazar esas operaciones incluso para el dueño de la tabla.

#### Scenario: La aplicación intenta modificar un asiento
- **WHEN** se ejecuta `UPDATE`, `DELETE` o `TRUNCATE` sobre los asientos con el rol de la aplicación
- **THEN** PostgreSQL responde con el error `42501` (permiso denegado)

#### Scenario: El dueño intenta borrar un asiento
- **WHEN** se ejecuta `DELETE` sobre un asiento con el rol dueño
- **THEN** el trigger rechaza la operación

### Requirement: TRF-24 Concurrencia sobre la misma cuenta
El sistema SHALL procesar transferencias concurrentes que afectan a las mismas cuentas sin perder ni duplicar dinero y sin deadlocks, bloqueando las cuentas en un orden determinista.

#### Scenario: Cien transferencias simultáneas
- **WHEN** una cuenta fondeada con 1000.00 recibe 100 peticiones simultáneas de 15.00 cada una, con llaves distintas, hacia un tercero
- **THEN** exactamente 66 quedan `COMPLETED` y 34 `REJECTED` con `INSUFFICIENT_FUNDS`
- **AND** el saldo final de la cuenta es exactamente 10.00
- **AND** la suma global de asientos es 0 y el uso diario del usuario es 990.00

#### Scenario: Transferencias cruzadas
- **WHEN** Ana envía a Luis y Luis envía a Ana al mismo tiempo, repetidamente
- **THEN** ninguna petición falla por deadlock y los saldos concilian con los asientos

### Requirement: TRF-25 Auditoría de transferencias
El sistema SHALL registrar en la misma transacción de cada operación los eventos `TRANSFER_CREATED`, `TRANSFER_OTP_SENT`, `TRANSFER_OTP_RESENT`, `OTP_ATTEMPT_FAILED`, `OTP_ATTEMPTS_EXHAUSTED`, `TRANSFER_COMPLETED`, `TRANSFER_REJECTED` y `TRANSFER_FAILED`, con montos, estados y motivos pero sin el código OTP ni datos personales. Si el evento no puede registrarse, la operación completa MUST revertirse.

#### Scenario: Transferencia completada auditada
- **WHEN** se completa una transferencia
- **THEN** existen los eventos `TRANSFER_CREATED` y `TRANSFER_COMPLETED` con su `transferId` y monto

#### Scenario: Falla la auditoría
- **WHEN** el registro del evento de auditoría falla durante una transferencia
- **THEN** no se crea la transferencia ni cambia ningún saldo

### Requirement: TRF-26 Consulta de una transferencia como comprobante
La API SHALL responder `GET /transfers/{transferId}` (`getTransfer`) con la transferencia solo si su cuenta de origen pertenece al usuario autenticado, incluyendo destino con nombre y últimos 4 dígitos de CLABE, monto, concepto, referencia, estado y fechas, para usarla como comprobante. En otro caso MUST responder 404 `NOT_FOUND`.

#### Scenario: Comprobante propio
- **WHEN** Ana consulta una transferencia que ella envió
- **THEN** la API responde 200 con `destination.displayName`, `destination.clabeLast4`, `amount`, `concept`, `reference`, `status` y `completedAt`

#### Scenario: Transferencia de otro usuario
- **WHEN** Ana consulta una transferencia enviada por Luis
- **THEN** la API responde 404 `NOT_FOUND`

### Requirement: TRF-27 Programación de una transferencia
La API SHALL aceptar en `POST /transfers` el campo opcional `scheduledFor`, un instante en RFC 3339 con desfase (por ejemplo `2026-10-20T14:30:00-06:00` o `...Z`) con precisión de minuto, que MUST estar entre 10 minutos y 90 días después del momento de la petición, ambos inclusive. Con `scheduledFor` y un monto de hasta 10000.00, la API MUST responder 201 con `status` `SCHEDULED` y `scheduledFor`, sin crear asientos ni modificar saldos ni el límite diario.

Validación:
- Un instante fuera de la ventana MUST responder 422 `VALIDATION_FAILED` con el error en `/scheduledFor` y el código `DATE_OUT_OF_RANGE`, incluido el de hace un momento.
- Un instante que no es RFC 3339 con desfase, que no existe o que trae segundos o fracción distintos de cero MUST responder lo mismo con `INVALID_FORMAT`.
- Las validaciones de propiedad, misma cuenta, monto, concepto y referencia (TRF-06 a TRF-09) MUST aplicar igual que en una transferencia inmediata.
- Al programar, la API MUST NOT validar el saldo ni el límite del día actual. La única excepción: una transferencia a un tercero con un monto mayor al límite diario MUST responder 422 `VALIDATION_FAILED` con el error en `/amount` y el código `TOO_LARGE`, porque nunca podría ejecutarse.

Amplía TRF-01.

#### Scenario: Programar para mañana
- **WHEN** el 14 de octubre de 2026 a las 12:00 en la Ciudad de México Ana programa 1000.00 a Luis para `2026-10-15T14:30:00-06:00`
- **THEN** la API responde 201 con `status` `SCHEDULED` y `scheduledFor` que es ese instante
- **AND** su saldo y su límite diario no cambian

#### Scenario: Programar para hoy con hora
- **WHEN** el 14 de octubre de 2026 a las 12:00 en la Ciudad de México Ana programa una transferencia para `2026-10-14T12:10:00-06:00`
- **THEN** la API responde 201 con `status` `SCHEDULED`

#### Scenario: A menos de 10 minutos
- **WHEN** el 14 de octubre de 2026 a las 12:00 en la Ciudad de México Ana programa una transferencia para `2026-10-14T12:09:00-06:00`
- **THEN** la API responde 422 `VALIDATION_FAILED` con el error en `/scheduledFor` y el código `DATE_OUT_OF_RANGE`

#### Scenario: Más de 90 días
- **WHEN** el 14 de octubre de 2026 a las 12:00 en la Ciudad de México Ana programa una transferencia para `2027-01-12T12:01:00-06:00`
- **THEN** la API responde 422 `VALIDATION_FAILED` con el código `DATE_OUT_OF_RANGE`
- **AND** `2027-01-12T12:00:00-06:00` se acepta

#### Scenario: Cualquier desfase
- **WHEN** Ana programa el mismo instante como `2026-10-20T20:30:00Z` y como `2026-10-20T14:30:00-06:00`
- **THEN** la API los trata como el mismo instante

#### Scenario: Con segundos
- **WHEN** Ana programa una transferencia para `2026-10-20T14:30:15-06:00`
- **THEN** la API responde 422 `VALIDATION_FAILED` con el error en `/scheduledFor` y el código `INVALID_FORMAT`

#### Scenario: Sin saldo suficiente hoy
- **WHEN** Ana, con saldo 100.00, programa 1000.00 a Luis para mañana
- **THEN** la API responde 201 con `status` `SCHEDULED`

#### Scenario: Monto mayor al límite diario
- **WHEN** Ana programa 50000.01 a un tercero
- **THEN** la API responde 422 `VALIDATION_FAILED` con el error en `/amount` y el código `TOO_LARGE`

#### Scenario: Programar entre cuentas propias
- **WHEN** Ana programa 5000.00 de "Principal" a "Ahorro" para `2026-10-20T10:00:00-06:00`
- **THEN** la API responde 201 con `status` `SCHEDULED` y `kind` `OWN`

### Requirement: TRF-28 Programación con OTP
Cuando el monto de una transferencia programada es mayor a 10000.00, la API SHALL crearla en `PENDING_OTP` con su `scheduledFor`, con las mismas reglas de envío, intentos, vencimiento y reenvío del código (TRF-14, TRF-15, TRF-17, TRF-19 y TRF-20). El correo MUST incluir la fecha y la hora programadas en hora de la Ciudad de México.

Al confirmarla con el código correcto, la API MUST:
- pasarla a `SCHEDULED` y responder 200, sin mover dinero ni revalidar el saldo o el límite;
- responder 200 sin consumir intentos si se vuelve a confirmar una transferencia que ya está en `SCHEDULED`.

Una transferencia programada que no se confirma a tiempo MUST quedar `EXPIRED` y nunca ejecutarse. Amplía TRF-14, TRF-16 y TRF-18.

#### Scenario: Programada mayor al umbral
- **WHEN** Ana programa 15000.00 a Luis para `2026-10-20T14:30:00-06:00`
- **THEN** la API responde 201 con `status` `PENDING_OTP` y ese `scheduledFor`
- **AND** el correo con el código menciona el 20 de octubre de 2026 a las 14:30

#### Scenario: Confirmación de una programada
- **WHEN** Ana confirma esa transferencia con el código correcto
- **THEN** la API responde 200 con `status` `SCHEDULED`
- **AND** su saldo y su límite diario no cambian

#### Scenario: Doble confirmación
- **WHEN** Ana confirma otra vez una transferencia que ya está en `SCHEDULED`
- **THEN** la API responde 200 con `status` `SCHEDULED` sin consumir intentos

#### Scenario: Confirmación después de la hora programada
- **WHEN** una transferencia programada para las 12:10 se crea a las 12:00 y se confirma a las 12:11
- **THEN** queda en `SCHEDULED` y se ejecuta en la siguiente pasada del proceso de ejecución

#### Scenario: Programada sin confirmar
- **WHEN** pasan 5 minutos sin confirmar una transferencia programada en `PENDING_OTP`
- **THEN** `GET /transfers/{transferId}` muestra `status` `EXPIRED`
- **AND** nunca se ejecuta

### Requirement: TRF-29 Idempotencia y tope de programadas
Las reglas de idempotencia de TRF-02 a TRF-05 SHALL aplicar a las transferencias programadas, y `scheduledFor` MUST formar parte del contenido que se compara, como instante: dos escrituras del mismo instante con distinto desfase son la misma petición. Reutilizar una llave con otro instante, o con instante cuando la original no lo tenía, MUST responder 422 `IDEMPOTENCY_KEY_REUSED`. La huella de las transferencias inmediatas existentes MUST NOT cambiar.

Cada usuario SHALL tener como máximo 20 transferencias programadas activas, contando las que están en `SCHEDULED` y las programadas en `PENDING_OTP` vigentes. Crear una más MUST responder 422 `SCHEDULED_LIMIT_REACHED` sin guardar la transferencia ni consumir la llave. El tope MUST respetarse aunque lleguen peticiones simultáneas con llaves distintas.

#### Scenario: Reintento de una programación
- **WHEN** el cliente reenvía la misma programación con la misma llave
- **THEN** la API responde 200 con la misma transferencia, `status` `SCHEDULED` e `Idempotent-Replayed: true`

#### Scenario: Misma llave con otro minuto
- **WHEN** se reutiliza la llave de una programación para las 14:30 con `scheduledFor` de las 14:31 del mismo día
- **THEN** la API responde 422 `IDEMPOTENCY_KEY_REUSED`

#### Scenario: Mismo instante con otro desfase
- **WHEN** se reintenta con la misma llave una programación para `2026-10-20T14:30:00-06:00` escrita como `2026-10-20T20:30:00Z`
- **THEN** la API la reconoce como reintento y responde 200 con la transferencia original

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
A partir del instante `scheduledFor`, el sistema SHALL ejecutar cada transferencia en `SCHEDULED`, sin intervención del usuario y sin OTP. Las ejecuta en orden de `scheduledFor` y luego de creación. El proceso de ejecución revisa las vencidas en pasadas periódicas, así que la ejecución ocurre en la primera pasada posterior al instante.

La ejecución MUST:
- validar bajo bloqueo el saldo y, para terceros, el límite diario del día en que se ejecuta, igual que una transferencia inmediata;
- si las validaciones pasan, completarla con sus dos asientos, con `completedAt` igual a la hora de ejecución, y consumir el límite del día de ejecución;
- si no pasan, marcarla `FAILED` con `failureReason` `INSUFFICIENT_FUNDS` o `DAILY_LIMIT_EXCEEDED` y sin asientos.

Una transferencia cuyo instante ya pasó porque el proceso no estuvo disponible MUST ejecutarse en la siguiente pasada. Amplía TRF-11 y TRF-12.

#### Scenario: Ejecución a la hora programada
- **WHEN** una transferencia de 1000.00 a Luis está programada para las 14:30 del 15 de octubre de 2026 y el proceso corre a las 14:30:20 en la Ciudad de México
- **THEN** la transferencia queda `COMPLETED` con dos asientos
- **AND** el historial de Ana muestra un `TRANSFER_OUT` del 15 de octubre

#### Scenario: Antes de su hora
- **WHEN** el proceso corre a las 14:29 del 15 de octubre en la Ciudad de México
- **THEN** la transferencia programada para las 14:30 sigue en `SCHEDULED`

#### Scenario: Saldo insuficiente al ejecutar
- **WHEN** al ejecutarse una programada de 1000.00, la cuenta de origen tiene 500.00
- **THEN** queda `FAILED` con `failureReason` `INSUFFICIENT_FUNDS`, sin asientos, y el saldo sigue en 500.00

#### Scenario: Límite del día de ejecución
- **WHEN** el día de ejecución Ana ya transfirió 45000.00 a terceros y vence una programada de 6000.00 a un tercero
- **THEN** queda `FAILED` con `failureReason` `DAILY_LIMIT_EXCEEDED`

#### Scenario: Límite diario que cruza medianoche
- **WHEN** Ana agotó el límite del 14 de octubre y una programada de 1000.00 a un tercero para las 00:00 del 15 se ejecuta a las 00:00:30 del 15
- **THEN** se completa y consume el límite del 15, no el del 14

#### Scenario: Ejecución atrasada
- **WHEN** el proceso no corrió entre las 08:00 y las 09:00 del 15 de octubre y corre a las 09:00
- **THEN** ejecuta la programada de las 08:30 a las 09:00 y consume el límite del 15

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
La API SHALL responder `GET /transfers/scheduled` (`listScheduledTransfers`) con las transferencias del usuario autenticado en `SCHEDULED`, ordenadas por `scheduledFor` y luego por fecha de creación, ambas ascendentes. Cada transferencia lleva el destino con nombre y últimos 4 dígitos de la CLABE, el monto, el concepto, la referencia (`null` si no tiene) y `scheduledFor` como instante. Las ejecutadas, fallidas, canceladas, vencidas y las que esperan su OTP MUST NOT aparecer.

#### Scenario: Programadas en orden
- **WHEN** Ana tiene programadas para las 10:00 del 20, las 16:00 del 15 y las 16:00 del 15 de octubre (esta última creada después)
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
Cuando una transferencia programada queda `FAILED` al ejecutarse, el sistema SHALL enviar al correo verificado del usuario un aviso con el monto, el nombre del destino, los últimos 4 dígitos de su CLABE, la fecha y hora programadas en hora de la Ciudad de México y el motivo en lenguaje claro. El correo MUST enviarse después de confirmar la transacción. Si su envío falla, MUST registrarse en los logs sin revertir el estado `FAILED` y sin repetir la ejecución.

#### Scenario: Aviso por saldo insuficiente
- **WHEN** una programada de 1000.00 a Luis falla por saldo insuficiente
- **THEN** el buzón de Ana recibe un correo con "$1,000.00", "Luis", los últimos 4 dígitos de su CLABE, la fecha y hora programadas y "saldo insuficiente"

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
