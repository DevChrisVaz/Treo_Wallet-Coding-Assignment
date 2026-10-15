## ADDED Requirements

### Requirement: TRF-37 Límites de tasa de las transferencias
La API SHALL limitar por usuario autenticado `POST /transfers` (ventana de 10 minutos, 30 peticiones por defecto), `POST /transfers/{transferId}/confirm` (15 minutos, 15), `POST /transfers/{transferId}/otp/resend` (15 minutos, 6) y `POST /transfers/{transferId}/cancel` (10 minutos, 20), cada una con su propio contador (PLT-19). Al superar un tope MUST responder `429 RATE_LIMITED` con `Retry-After` (PLT-09), sin crear, confirmar, reenviar ni cancelar nada. Las repeticiones de una misma `Idempotency-Key` MUST contar como peticiones. Los contadores MUST ser por usuario: el cupo agotado de un usuario MUST NOT afectar a otro, y una petición sin access token válido MUST NOT consumir el cupo de nadie.

#### Scenario: Creaciones por encima del tope
- **WHEN** un usuario hace más peticiones a `POST /transfers` que el tope dentro de la ventana
- **THEN** la que lo excede responde `429 RATE_LIMITED` con `Retry-After`
- **AND** no se crea ninguna transferencia por esa petición

#### Scenario: Confirmaciones, reenvíos y cancelaciones
- **WHEN** un usuario excede el tope de `confirm`, de `otp/resend` o de `cancel`
- **THEN** la petición que lo excede responde `429 RATE_LIMITED` con `Retry-After`
- **AND** la transferencia queda como estaba

#### Scenario: Contadores independientes por operación
- **WHEN** un usuario agota el tope de `POST /transfers`
- **THEN** todavía puede confirmar, reenviar y cancelar dentro de sus propios topes

#### Scenario: Contadores independientes por usuario
- **WHEN** un usuario agota el tope de `POST /transfers`
- **THEN** otro usuario crea una transferencia con `201`

#### Scenario: Repetir la llave cuenta
- **WHEN** un cliente repite la misma `Idempotency-Key` hasta superar el tope
- **THEN** la repetición que lo excede responde `429`, aunque las anteriores hayan devuelto la transferencia original con `Idempotent-Replayed: true`

#### Scenario: Reintentos de la app dentro del tope
- **WHEN** la app envía una transferencia con la misma llave y la reintenta cinco veces
- **THEN** ninguna de las seis peticiones recibe `429` con los topes por defecto

#### Scenario: La ventana se reinicia
- **WHEN** pasa el tiempo indicado en `Retry-After`
- **THEN** el mismo usuario vuelve a crear transferencias

#### Scenario: Sin token no hay cupo gastado
- **WHEN** se hacen más peticiones sin access token que el tope
- **THEN** todas responden `401` y el cupo del usuario no cambia

### Requirement: TRF-38 Comprobante al remitente
Cuando una transferencia a un beneficiario llega a `COMPLETED`, la API SHALL enviar al email del remitente el comprobante "Transferencia realizada" con el monto en formato es-MX, el nombre del destino y los últimos 4 dígitos de su CLABE, el concepto, la referencia si la hay, la fecha y la hora en `America/Mexico_City` y el id de la transferencia. El comprobante MUST enviarse una sola vez por transferencia, en la ejecución que la dejó `COMPLETED`: al crearla cuando no pide código, al confirmarla con el código correcto, o cuando el ejecutor de programadas la ejecuta. MUST NOT enviarse en una repetición de la llave, en una confirmación de una transferencia ya completada, en un traspaso entre cuentas propias, en un fondeo (seed y `db:fund`) ni al destinatario. MUST NOT incluir la CLABE completa ni códigos. Una falla al enviarlo MUST NOT cambiar la respuesta ni el estado de la transferencia (PLT-16).

#### Scenario: Transferencia inmediata
- **WHEN** un usuario crea una transferencia de $250.00 a un beneficiario por debajo del umbral del código
- **THEN** la respuesta es `201` con la transferencia `COMPLETED`
- **AND** a su email llega un solo comprobante con "$250.00", el nombre del destino, la terminación de la CLABE, el concepto y el id de la transferencia
- **AND** el comprobante no contiene la CLABE completa

#### Scenario: Transferencia con código
- **WHEN** un usuario confirma con el código correcto una transferencia por encima del umbral
- **THEN** la transferencia queda `COMPLETED`
- **AND** a su email llega un solo comprobante, además del correo del código

#### Scenario: Programada ejecutada
- **WHEN** el ejecutor de programadas ejecuta una transferencia programada a un beneficiario
- **THEN** a su email llega un solo comprobante con la fecha y la hora de la ejecución

#### Scenario: Programada que falla
- **WHEN** el ejecutor deja una programada en `FAILED`
- **THEN** llega el aviso de TRF-35 y ningún comprobante

#### Scenario: Repetición de la llave
- **WHEN** un cliente repite la creación con la misma llave
- **THEN** la respuesta es la original con `Idempotent-Replayed: true` y no se envía otro comprobante

#### Scenario: Confirmación repetida
- **WHEN** un usuario confirma una transferencia que ya está `COMPLETED`
- **THEN** la respuesta es `200` y no se envía otro comprobante

#### Scenario: Traspaso entre cuentas propias
- **WHEN** un usuario traspasa dinero entre sus cuentas
- **THEN** no se envía ningún comprobante

#### Scenario: Rechazo
- **WHEN** una transferencia queda `REJECTED` o `FAILED`
- **THEN** no se envía ningún comprobante

#### Scenario: El destinatario no recibe nada
- **WHEN** una transferencia a otro usuario de la plataforma queda `COMPLETED`
- **THEN** el email del destinatario no recibe ningún correo

#### Scenario: Seed y fondeo
- **WHEN** se ejecuta `db:seed` o `db:fund`
- **THEN** no se envía ningún correo

#### Scenario: Correo caído
- **WHEN** el servidor de correo no responde al completar una transferencia
- **THEN** la respuesta es la misma y la transferencia queda `COMPLETED`
