## MODIFIED Requirements

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

### Requirement: TRF-35 Aviso de falla de una programada
Cuando una transferencia programada queda `FAILED` al ejecutarse, el sistema SHALL enviar al correo verificado del usuario un aviso con el monto, el nombre del destino, los últimos 4 dígitos de su CLABE, la fecha y hora programadas en hora de la Ciudad de México y el motivo en lenguaje claro. El correo MUST enviarse después de confirmar la transacción. Si su envío falla, MUST registrarse en los logs sin revertir el estado `FAILED` y sin repetir la ejecución.

#### Scenario: Aviso por saldo insuficiente
- **WHEN** una programada de 1000.00 a Luis falla por saldo insuficiente
- **THEN** el buzón de Ana recibe un correo con "$1,000.00", "Luis", los últimos 4 dígitos de su CLABE, la fecha y hora programadas y "saldo insuficiente"

#### Scenario: Falla el envío del aviso
- **WHEN** el servidor de correo no está disponible al fallar una programada
- **THEN** la transferencia queda `FAILED` y la siguiente pasada no la vuelve a ejecutar
