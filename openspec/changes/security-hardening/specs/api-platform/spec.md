## MODIFIED Requirements

### Requirement: PLT-16 Entrega de correo transaccional
La API SHALL enviar los correos transaccionales (códigos de verificación, avisos de registro, códigos de confirmación de transferencias, avisos de seguridad y comprobantes de transferencias) por SMTP después de confirmar la transacción de la operación que los origina. Una falla al enviar MUST NOT revertir la operación ya confirmada, MUST registrarse en el log sin exponer el código ni el destinatario completo, y MUST dejar al usuario la posibilidad de pedir un reenvío cuando el correo sea un código. Un aviso o un comprobante (IDN-18, IDN-19, BEN-12, TRF-38) MUST NOT cambiar el código, el cuerpo ni los headers de la respuesta de la operación que lo origina, ni retrasarla mientras se envía.

#### Scenario: Servidor de correo caído durante el registro
- **WHEN** un usuario se registra mientras el servidor SMTP no responde
- **THEN** la API responde `202` igual que siempre
- **AND** el usuario queda registrado sin verificar
- **AND** puede pedir el reenvío del código cuando el servidor vuelva

#### Scenario: Servidor de correo caído durante un inicio de sesión
- **WHEN** un usuario inicia sesión con su contraseña correcta mientras el servidor SMTP no responde
- **THEN** la API responde `200` con los mismos tokens que respondería con el servidor disponible
- **AND** el log registra la falla con el destinatario enmascarado y sin el cuerpo del correo

## ADDED Requirements

### Requirement: PLT-19 Límites de tasa configurables
Los topes de los límites de tasa de `POST /auth/refresh`, `POST /auth/logout`, `POST /transfers`, `POST /transfers/{transferId}/confirm`, `POST /transfers/{transferId}/otp/resend` y `POST /transfers/{transferId}/cancel` SHALL poder cambiarse con variables de entorno, cada una con un valor por defecto y validada al arrancar (PLT-08). Un valor que no sea un entero entre 1 y 10000 MUST impedir el arranque y el error MUST nombrar la variable sin mostrar su valor. Los límites MUST responder como indica PLT-09.

#### Scenario: Valores por defecto
- **WHEN** la API arranca sin ninguna de las variables de los límites nuevos
- **THEN** arranca con los topes por defecto documentados en la configuración

#### Scenario: Tope configurado
- **WHEN** la API arranca con el tope de `confirm` igual a 2
- **THEN** la tercera confirmación de un usuario dentro de la ventana responde `429 RATE_LIMITED`

#### Scenario: Valor inválido
- **WHEN** la API arranca con un tope igual a `0` o a `abc`
- **THEN** el arranque falla con un error que nombra la variable y no incluye el valor

### Requirement: PLT-20 Respuestas sin caché
La API SHALL enviar `Cache-Control: no-store` en todas sus respuestas, incluidas las de error (`application/problem+json`), las de rutas inexistentes, las `429` y `GET /health`. La única excepción MUST ser la documentación navegable del contrato (`GET /docs` y `GET /openapi.yaml`, PLT-11).

#### Scenario: Respuesta con tokens
- **WHEN** un usuario inicia sesión con éxito
- **THEN** la respuesta `200` lleva `Cache-Control: no-store`

#### Scenario: Respuesta autenticada
- **WHEN** un usuario autenticado llama a `GET /me`
- **THEN** la respuesta lleva `Cache-Control: no-store`

#### Scenario: Respuesta de error
- **WHEN** una petición responde `401 UNAUTHENTICATED`, `404 NOT_FOUND`, `422 VALIDATION_FAILED` o `429 RATE_LIMITED`
- **THEN** la respuesta lleva `Cache-Control: no-store`

#### Scenario: Salud del servicio
- **WHEN** se llama a `GET /health`
- **THEN** la respuesta lleva `Cache-Control: no-store`

#### Scenario: Documentación fuera de producción
- **WHEN** se llama a `GET /openapi.yaml` fuera de producción
- **THEN** la respuesta no lleva `Cache-Control: no-store`
