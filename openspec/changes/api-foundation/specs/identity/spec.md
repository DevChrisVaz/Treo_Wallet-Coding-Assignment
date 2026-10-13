## Purpose

Define cómo una persona se registra, verifica su correo, inicia y cierra sesión y obtiene tokens en la billetera, sin permitir la enumeración de cuentas por email y con sesiones que resisten el robo de tokens y la red móvil inestable.

## ADDED Requirements

### Requirement: IDN-01 Registro con respuesta uniforme
`POST /auth/register` SHALL responder siempre `202` con el mismo cuerpo, sin importar si el email ya existe, para no permitir la enumeración de cuentas. Según el estado del email, la API MUST hacer exactamente una de estas acciones: si el email es nuevo y los datos son válidos y únicos, crear el usuario sin verificar y enviarle un código de verificación; si el email pertenece a un usuario verificado, enviar a ese email un aviso de intento de registro sin crear nada; si el email pertenece a un usuario sin verificar, reenviar el código de verificación conservando los datos originales del registro.

#### Scenario: Email nuevo
- **WHEN** se registra un email que no existe con datos válidos y únicos
- **THEN** la respuesta es `202`
- **AND** existe un usuario sin verificar con ese email
- **AND** a ese email llega un correo con un código de 6 dígitos

#### Scenario: Email ya verificado
- **WHEN** se registra un email que pertenece a un usuario verificado
- **THEN** la respuesta es `202` con el mismo cuerpo que en un registro nuevo
- **AND** no se crea ni modifica ningún usuario
- **AND** al email llega un aviso de que alguien intentó registrarse con él

#### Scenario: Email registrado sin verificar
- **WHEN** se registra de nuevo un email cuyo usuario aún no verifica, con datos distintos
- **THEN** la respuesta es `202`
- **AND** los datos guardados del usuario no cambian
- **AND** se envía un código nuevo que invalida el anterior

### Requirement: IDN-02 Datos obligatorios del registro
El registro SHALL exigir email, contraseña, nombre completo, CURP, RFC y teléfono. La API MUST normalizar el email (sin espacios al inicio o al final y en minúsculas); MUST exigir una contraseña de 12 a 128 caracteres sin reglas de composición; MUST validar la estructura de la CURP y su dígito verificador; MUST validar la estructura del RFC de persona física y que su fecha sea una fecha real; y MUST aceptar el teléfono como 10 dígitos nacionales y guardarlo en formato E.164 (`+52` seguido de los 10 dígitos). Los datos inválidos MUST responder `422 VALIDATION_FAILED` con el `pointer` de cada campo. La identidad no se verifica contra registros oficiales.

#### Scenario: CURP con dígito verificador incorrecto
- **WHEN** se registra una CURP con estructura válida pero cuyo último dígito no corresponde a los 17 caracteres anteriores
- **THEN** la API responde `422 VALIDATION_FAILED` con `pointer` igual a `/curp`

#### Scenario: RFC con fecha imposible
- **WHEN** se registra un RFC cuya fecha es `990231` (31 de febrero)
- **THEN** la API responde `422 VALIDATION_FAILED` con `pointer` igual a `/rfc`

#### Scenario: Contraseña fuera de rango
- **WHEN** se registra una contraseña de 11 caracteres o de 129 caracteres
- **THEN** la API responde `422 VALIDATION_FAILED` con `pointer` igual a `/password`

#### Scenario: Email con mayúsculas y espacios
- **WHEN** se registra `"  Ana@Example.COM "` y después se inicia sesión con `ana@example.com`
- **THEN** ambos se refieren al mismo usuario

### Requirement: IDN-03 Unicidad de los datos de identidad
Email, CURP, RFC y teléfono SHALL ser únicos entre todos los usuarios, y la base de datos MUST garantizarlo con constraints únicas (el email sin distinguir mayúsculas). Un registro que choca con la CURP, el RFC o el teléfono de otro usuario MUST responder `202` igual que cualquier registro, MUST NOT crear al usuario y MUST enviar al email indicado un aviso de que el registro no pudo completarse, sin decir qué dato chocó.

#### Scenario: CURP de otro usuario con email nuevo
- **WHEN** se registra un email nuevo con la CURP de un usuario existente
- **THEN** la respuesta es `202`
- **AND** no se crea el usuario
- **AND** al email indicado llega un aviso genérico de que el registro no pudo completarse

#### Scenario: Unicidad garantizada en la base
- **WHEN** dos registros simultáneos usan el mismo RFC con emails distintos
- **THEN** a lo sumo uno de ellos crea un usuario

### Requirement: IDN-04 Almacenamiento seguro de contraseñas
La API SHALL guardar las contraseñas solo como hash argon2id con sal aleatoria. La contraseña MUST NOT guardarse, registrarse en logs ni devolverse en ninguna respuesta.

#### Scenario: Contraseña guardada como hash
- **WHEN** se registra un usuario
- **THEN** la base de datos guarda un hash argon2id y no la contraseña en claro

### Requirement: IDN-05 Código de verificación de correo
El código de verificación SHALL ser de 6 dígitos generados con un generador criptográficamente seguro, guardarse solo como hash, valer 15 minutos y admitir 3 intentos fallidos. Un código MUST usarse una sola vez. Cada reenvío MUST invalidar el código anterior y reiniciar los intentos, con un máximo de 3 reenvíos por registro.

#### Scenario: Código vencido
- **WHEN** se intenta verificar con un código correcto 16 minutos después de emitido
- **THEN** la API responde `422 VERIFICATION_CODE_INVALID` con `attemptsRemaining` igual a 0

#### Scenario: Código anterior invalidado por un reenvío
- **WHEN** se pide un reenvío y luego se usa el código anterior
- **THEN** la API responde `422 VERIFICATION_CODE_INVALID`

#### Scenario: Código guardado como hash
- **WHEN** se emite un código
- **THEN** la base de datos no contiene los 6 dígitos en claro

### Requirement: IDN-06 Verificación de correo
`POST /auth/verify-email` SHALL, con un email y un código válidos, marcar el correo como verificado, abrir las cuentas del usuario (ACC-04), registrar el evento de auditoría y devolver `200` con el usuario y un par de tokens, todo en una sola transacción. Un código incorrecto MUST responder `422 VERIFICATION_CODE_INVALID` con `attemptsRemaining`; al tercer fallo el código MUST quedar inutilizable. Un email inexistente o ya verificado MUST responder igual que un código incorrecto, sin revelar el motivo.

#### Scenario: Verificación exitosa
- **WHEN** un usuario sin verificar envía su email y el código vigente
- **THEN** la respuesta es `200` con `user` y `tokens`
- **AND** el usuario queda verificado y tiene sus dos cuentas

#### Scenario: Tercer intento fallido
- **WHEN** se envía un código incorrecto por tercera vez
- **THEN** la API responde `422 VERIFICATION_CODE_INVALID` con `attemptsRemaining` igual a 0
- **AND** el código correcto ya no funciona

#### Scenario: Email desconocido
- **WHEN** se intenta verificar un email que no existe
- **THEN** la respuesta es la misma que con un código incorrecto

### Requirement: IDN-07 Reenvío del código de verificación
`POST /auth/verify-email/resend` SHALL responder siempre `202` con el mismo cuerpo. Solo cuando el email pertenece a un usuario sin verificar y no se ha llegado al máximo de reenvíos, MUST emitir y enviar un código nuevo; en cualquier otro caso MUST NOT enviar nada.

#### Scenario: Reenvío después del límite
- **WHEN** se pide un cuarto reenvío para el mismo registro
- **THEN** la respuesta es `202`
- **AND** no se envía ningún correo

### Requirement: IDN-08 Inicio de sesión sin enumeración
`POST /auth/login` SHALL devolver `200` con el usuario y un par de tokens cuando el email y la contraseña son correctos y el correo está verificado. Si el email no existe o la contraseña es incorrecta, MUST responder `401 INVALID_CREDENTIALS` con el mismo cuerpo, y MUST ejecutar la verificación de contraseña también cuando el email no existe, para que ambos casos tarden lo mismo. Con contraseña correcta y correo sin verificar MUST responder `403 EMAIL_NOT_VERIFIED`.

#### Scenario: Email inexistente y contraseña incorrecta responden igual
- **WHEN** se intenta iniciar sesión con un email inexistente y, por separado, con un email existente y contraseña incorrecta
- **THEN** ambas respuestas son `401 INVALID_CREDENTIALS` con el mismo cuerpo salvo el `requestId`
- **AND** en ambos casos se ejecuta la verificación de un hash de contraseña

#### Scenario: Correo sin verificar
- **WHEN** un usuario sin verificar inicia sesión con su contraseña correcta
- **THEN** la API responde `403 EMAIL_NOT_VERIFIED`

### Requirement: IDN-09 Access token de vida corta
El access token SHALL ser un JWT firmado con HS256, válido por 10 minutos, con los claims `sub` (id del usuario), `iss`, `aud`, `iat`, `exp` y `jti`. Al verificarlo, la API MUST aceptar solo el algoritmo HS256 y MUST rechazar tokens con otro algoritmo (incluido `none`), con firma inválida, vencidos o con `iss` o `aud` distintos a los configurados.

#### Scenario: Token con algoritmo none
- **WHEN** se llama a una ruta protegida con un token cuyo header dice `"alg": "none"`
- **THEN** la API responde `401 UNAUTHENTICATED`

#### Scenario: Token vencido
- **WHEN** se usa un access token 10 minutos y 1 segundo después de emitido
- **THEN** la API responde `401 UNAUTHENTICATED`

#### Scenario: Audiencia incorrecta
- **WHEN** se usa un token válido firmado con el secreto correcto pero con otra `aud`
- **THEN** la API responde `401 UNAUTHENTICATED`

### Requirement: IDN-10 Rutas protegidas por defecto
Toda ruta de la API SHALL requerir un access token válido en el header `Authorization: Bearer`, salvo `GET /health`, las rutas `/auth/*`, `GET /docs` y `GET /openapi.yaml`. Una petición sin token o con un token inválido a una ruta protegida MUST responder `401 UNAUTHENTICATED`.

#### Scenario: Ruta protegida sin token
- **WHEN** se llama a `GET /me` sin header `Authorization`
- **THEN** la API responde `401 UNAUTHENTICATED`

### Requirement: IDN-11 Refresh token opaco con rotación
El refresh token SHALL ser un valor aleatorio opaco de al menos 32 bytes, guardado solo como hash, que pertenece a una familia creada al iniciar sesión o verificar el correo. Cada uso válido en `POST /auth/refresh` MUST emitir un par nuevo, marcar el token usado y registrar cuál es su sucesor. Cada refresh token MUST vencer a los 7 días de emitido y toda la familia MUST vencer a los 30 días de iniciada la sesión, aunque se siga usando. Un token inválido, vencido o revocado MUST responder `401 SESSION_REVOKED`.

#### Scenario: Rotación normal
- **WHEN** se usa un refresh token vigente
- **THEN** la respuesta es `200` con un access token y un refresh token nuevos
- **AND** el refresh token anterior queda marcado como usado

#### Scenario: Familia vencida
- **WHEN** se usa un refresh token vigente de una familia iniciada hace más de 30 días
- **THEN** la API responde `401 SESSION_REVOKED`

#### Scenario: Token guardado como hash
- **WHEN** se emite un refresh token
- **THEN** la base de datos no contiene el valor del token en claro

### Requirement: IDN-12 Detección de reuso con ventana de gracia
Si se presenta un refresh token ya usado, la API SHALL tratarlo como reuso, revocar toda la familia, registrar el evento `REFRESH_TOKEN_REUSE_DETECTED` y responder `401 SESSION_REVOKED`, salvo una excepción: si el token se usó hace 30 segundos o menos y su sucesor no se ha usado, MUST revocar ese sucesor y emitir uno nuevo, para tolerar el reintento de un cliente que perdió la respuesta. Las peticiones de refresh simultáneas con el mismo token MUST procesarse una después de otra.

#### Scenario: Reintento tras perder la respuesta
- **WHEN** un cliente usa un refresh token, pierde la respuesta y lo vuelve a usar 3 segundos después
- **THEN** la segunda petición responde `200` con un par nuevo
- **AND** el sucesor emitido en la primera petición queda revocado
- **AND** la familia sigue activa

#### Scenario: Reuso fuera de la ventana
- **WHEN** se presenta un refresh token que se usó hace más de 30 segundos
- **THEN** la API responde `401 SESSION_REVOKED`
- **AND** todos los tokens de la familia quedan revocados
- **AND** se registra el evento `REFRESH_TOKEN_REUSE_DETECTED`

#### Scenario: Reuso cuando el sucesor ya se usó
- **WHEN** se presenta un refresh token dentro de la ventana de 30 segundos pero su sucesor ya fue usado
- **THEN** la API trata la petición como reuso y revoca toda la familia

#### Scenario: Refresh simultáneo con el mismo token
- **WHEN** llegan dos peticiones de refresh con el mismo token al mismo tiempo
- **THEN** ambas responden `200`
- **AND** al terminar existe exactamente un refresh token vigente en la familia

### Requirement: IDN-13 Cierre de sesión
`POST /auth/logout` SHALL revocar la familia del refresh token recibido y responder `204`. MUST ser idempotente: un token desconocido, ya revocado o vencido también responde `204`.

#### Scenario: Refresh después del cierre de sesión
- **WHEN** un usuario cierra sesión y luego usa cualquier refresh token de esa familia
- **THEN** la API responde `401 SESSION_REVOKED`

#### Scenario: Cierre de sesión repetido
- **WHEN** se llama dos veces a `POST /auth/logout` con el mismo token
- **THEN** ambas respuestas son `204`

### Requirement: IDN-14 Datos del usuario autenticado
`GET /me` SHALL devolver el id, email, nombre completo, fechas de verificación y de creación, y el teléfono, la CURP y el RFC enmascarados, dejando visibles solo los fragmentos que indica el contrato.

#### Scenario: Datos personales enmascarados
- **WHEN** un usuario autenticado llama a `GET /me`
- **THEN** la respuesta no contiene su CURP, RFC ni teléfono completos

### Requirement: IDN-15 Límites de tasa en identidad
La API SHALL limitar `POST /auth/login` a 5 intentos por combinación de IP y email y a 20 intentos por IP, ambos por ventana de 15 minutos; y `POST /auth/register`, `POST /auth/verify-email` y `POST /auth/verify-email/resend` a 10 peticiones por IP por hora. Los límites MUST NOT bloquear la cuenta: un usuario que inicia sesión desde otra IP MUST poder hacerlo aunque una IP ajena haya agotado sus intentos con su email.

#### Scenario: Sexto intento de login
- **WHEN** desde una IP se hacen 6 intentos de login con el mismo email en 15 minutos
- **THEN** el sexto responde `429 RATE_LIMITED` con `Retry-After`

#### Scenario: Sin bloqueo de la cuenta
- **WHEN** una IP agota sus intentos con el email de un usuario
- **AND** el usuario inicia sesión desde otra IP con su contraseña correcta
- **THEN** el usuario obtiene `200`
