## ADDED Requirements

### Requirement: IDN-17 Límites de tasa de renovación y cierre de sesión
La API SHALL limitar `POST /auth/refresh` y `POST /auth/logout` por IP del cliente (PLT-07), cada una con su propio contador y su ventana de 15 minutos, con los topes por defecto de 120 y 60 peticiones (PLT-19). Al superarlos MUST responder `429 RATE_LIMITED` con `Retry-After` (PLT-09). Un límite MUST NOT revocar ni cerrar ninguna sesión: solo frena a la IP que lo excede, y las peticiones rechazadas MUST NOT consumir ni modificar el refresh token.

#### Scenario: Renovaciones por encima del tope
- **WHEN** desde una IP se hacen más peticiones a `refresh` que el tope dentro de la ventana
- **THEN** la petición que lo excede responde `429 RATE_LIMITED` con `Retry-After`

#### Scenario: Cierres de sesión por encima del tope
- **WHEN** desde una IP se hacen más peticiones a `logout` que el tope dentro de la ventana
- **THEN** la petición que lo excede responde `429 RATE_LIMITED` con `Retry-After`

#### Scenario: Un rechazo no toca el token
- **WHEN** una renovación se rechaza con `429` y luego pasa la ventana
- **THEN** el mismo refresh token, que no se usó, renueva la sesión con `200`

#### Scenario: Contadores independientes por IP
- **WHEN** una IP agota el tope de `refresh`
- **THEN** otra IP renueva su sesión con `200`
- **AND** la primera IP todavía puede llamar a `logout`

#### Scenario: La ventana se reinicia
- **WHEN** pasa el tiempo indicado en `Retry-After`
- **THEN** la misma IP vuelve a renovar con `200`

### Requirement: IDN-18 Aviso de inicio de sesión
Después de cada `POST /auth/login` que responde `200`, la API SHALL enviar al email del usuario el aviso "Iniciaste sesión en TreoWallet" con la fecha y la hora en `America/Mexico_City`, el tipo de cliente (la app o el navegador y el sistema operativo cuando se reconocen, y "un dispositivo" cuando no) y la IP con su último octeto oculto, e indicar qué hacer si no fue la persona. El aviso MUST NOT enviarse con `401`, `403` (correo sin verificar o registro en revisión) ni `429`, ni en `refresh` ni en la verificación del correo. El aviso MUST NOT incluir la contraseña, los tokens, el `User-Agent` tal como llegó ni la IP completa. Una falla al enviarlo MUST NOT cambiar la respuesta (PLT-16).

#### Scenario: Inicio de sesión desde un navegador
- **WHEN** un usuario inicia sesión con un `User-Agent` de Chrome en Windows desde la IP `203.0.113.7`
- **THEN** la respuesta es `200` con los tokens
- **AND** a su email llega un solo correo "Iniciaste sesión en TreoWallet"
- **AND** el correo menciona "Chrome en Windows", la IP `203.0.113.*` y la fecha y hora de la Ciudad de México
- **AND** el correo no contiene `203.0.113.7`

#### Scenario: Inicio de sesión desde la app
- **WHEN** un usuario inicia sesión con el `User-Agent` de la app en Android
- **THEN** el correo menciona "la app de TreoWallet en Android"

#### Scenario: Cliente no reconocido
- **WHEN** un usuario inicia sesión sin `User-Agent` o con uno que no se reconoce
- **THEN** el correo menciona "un dispositivo"

#### Scenario: Qué hacer si no fue la persona
- **WHEN** llega el aviso de inicio de sesión
- **THEN** el correo dice que, si no fue la persona, responda ese correo para que se revise

#### Scenario: Sin aviso con contraseña incorrecta
- **WHEN** alguien intenta iniciar sesión con una contraseña incorrecta
- **THEN** la respuesta es `401` y no se envía ningún correo

#### Scenario: Sin aviso si el correo no está verificado o el registro está en revisión
- **WHEN** un usuario con la contraseña correcta recibe `403 EMAIL_NOT_VERIFIED` o `403 REGISTRATION_IN_REVIEW`
- **THEN** no se envía ningún aviso de inicio de sesión

#### Scenario: Sin aviso al renovar ni al verificar el correo
- **WHEN** un usuario renueva su sesión con `refresh` o verifica su correo con éxito
- **THEN** no se envía ningún aviso de inicio de sesión

### Requirement: IDN-19 Aviso de sesión cerrada por seguridad
Cuando la API detecta el reuso de un refresh token y revoca su familia (IDN-12), SHALL enviar al email del dueño de la sesión el aviso "Cerramos una sesión por seguridad", con la fecha y la hora en `America/Mexico_City`, que debe iniciar sesión de nuevo y qué hacer si no reconoce lo ocurrido. El aviso MUST enviarse una sola vez por familia revocada y MUST NOT enviarse cuando el token no existe, está vencido o ya estaba revocado, ni en el reintento dentro de la ventana de gracia. MUST NOT incluir tokens. Una falla al enviarlo MUST NOT cambiar la respuesta `401 SESSION_REVOKED` (PLT-16).

#### Scenario: Reuso de un refresh token
- **WHEN** se presenta un refresh token ya usado fuera de la ventana de gracia
- **THEN** la respuesta es `401 SESSION_REVOKED` y la familia queda revocada
- **AND** al email del dueño llega un solo correo "Cerramos una sesión por seguridad"
- **AND** el correo no contiene el token

#### Scenario: El mismo token otra vez
- **WHEN** se presenta de nuevo el refresh token cuya familia ya se revocó
- **THEN** la respuesta es `401 SESSION_REVOKED` y no llega otro correo

#### Scenario: Reintento dentro de la ventana de gracia
- **WHEN** un cliente repite una renovación dentro de la ventana de gracia
- **THEN** la respuesta es `200` y no se envía ningún correo

#### Scenario: Token desconocido
- **WHEN** se presenta un refresh token que no existe
- **THEN** la respuesta es `401 SESSION_REVOKED` y no se envía ningún correo
