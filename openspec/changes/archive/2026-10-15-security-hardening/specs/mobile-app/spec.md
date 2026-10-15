## ADDED Requirements

### Requirement: MOB-31 Un 429 no cierra la sesión ni se trata como falla del servidor
Cuando la API responde `429 RATE_LIMITED`, la app SHALL conservar la sesión y el refresh token. Si ocurre al renovar el access token, MUST NOT cerrar la sesión ni borrar el refresh token, y la petición que lo necesitaba MUST fallar con ese error. Si ocurre al crear, confirmar o reenviar el código de una transferencia, la app MUST mostrar el mensaje de `RATE_LIMITED` del paquete de diseño con la espera de `Retry-After`, MUST NOT reintentar sola como con un `5xx` (MOB-10) y MUST dejar a la persona reintentar a mano con la misma llave de idempotencia.

#### Scenario: 429 al renovar
- **WHEN** la API responde `429` al renovar el access token
- **THEN** la sesión sigue iniciada y el refresh token sigue guardado

#### Scenario: 429 al crear la transferencia
- **WHEN** la API responde `429` con `Retry-After: 45` a la creación de una transferencia
- **THEN** la app muestra el mensaje de `RATE_LIMITED` con la espera de 45 segundos
- **AND** no envía otra petición por su cuenta
- **AND** el reintento manual usa la misma llave de idempotencia

#### Scenario: 429 al confirmar o reenviar el código
- **WHEN** la API responde `429` a la confirmación o al reenvío del código
- **THEN** la app muestra el mensaje de `RATE_LIMITED` con la espera
- **AND** la transferencia sigue pendiente de confirmación y no se reintenta sola

### Requirement: MOB-32 La app se identifica con su User-Agent
Cada petición de la app a la API SHALL llevar un `User-Agent` con el formato `TreoWallet-App/<versión> (<ios|android>)`, con la versión de la app y el sistema operativo del dispositivo, para que la API distinga a la app de un navegador (IDN-18). El valor MUST NOT incluir el modelo del dispositivo, el identificador del dispositivo ni datos de la persona.

#### Scenario: User-Agent de la app
- **WHEN** la app llama a cualquier operación de la API en Android
- **THEN** la petición lleva un `User-Agent` que empieza con `TreoWallet-App/` y termina con `(android)`

#### Scenario: Sin datos del dispositivo
- **WHEN** la app arma su `User-Agent`
- **THEN** solo contiene la versión de la app y `ios` o `android`
