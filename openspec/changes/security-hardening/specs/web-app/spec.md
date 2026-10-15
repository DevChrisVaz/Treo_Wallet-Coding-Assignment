## MODIFIED Requirements

### Requirement: WEB-10 Propagación de headers hacia la API
En cada llamada a la API, la web SHALL enviar la IP del cliente en `X-Forwarded-For`, el `User-Agent` del navegador y un `X-Request-Id`, reutilizando el que trae la petición del navegador o generando uno nuevo. El `User-Agent` MUST reenviarse tal como lo envió el navegador, para que la API describa y audite al cliente real; si la petición no trae uno, la web MUST NOT inventarlo. En la creación de transferencias, la web MUST reenviar sin cambios la `Idempotency-Key` recibida del navegador y MUST NOT generarla ni reintentar la llamada por su cuenta.

#### Scenario: IP del cliente
- **WHEN** un usuario con IP `203.0.113.7` inicia sesión
- **THEN** la llamada a `login` lleva `X-Forwarded-For` con `203.0.113.7`

#### Scenario: User-Agent del navegador
- **WHEN** un usuario inicia sesión desde un navegador con un `User-Agent` determinado
- **THEN** la llamada a `login` lleva ese mismo `User-Agent`
- **AND** la renovación del access token y las lecturas de esa sesión también lo llevan

#### Scenario: Petición sin User-Agent
- **WHEN** la petición del navegador no trae `User-Agent`
- **THEN** la llamada a la API no lleva uno inventado por la web

#### Scenario: Llave de idempotencia
- **WHEN** el navegador envía una creación de transferencia con la llave `K`
- **THEN** la llamada a `createTransfer` lleva `Idempotency-Key: K`
- **AND** la web hace exactamente una llamada a la API por esa petición

## ADDED Requirements

### Requirement: WEB-38 Headers de seguridad en toda respuesta
La web SHALL enviar en cada respuesta, incluidas las de `/bff/*` y `/_next/*`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` y un `Permissions-Policy` que deshabilite al menos cámara, micrófono, geolocalización y pagos. Solo cuando la cookie de sesión es segura (`SESSION_COOKIE_SECURE` verdadero, es decir, con HTTPS) SHALL enviar además `Strict-Transport-Security: max-age=63072000; includeSubDomains`. La política de referencia MUST permitir que las Server Actions reciban el `Origin` del propio sitio (WEB-06).

#### Scenario: Una página
- **WHEN** el navegador pide `/login`
- **THEN** la respuesta lleva `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` y `Permissions-Policy` con los valores indicados

#### Scenario: Una respuesta del BFF
- **WHEN** el navegador llama a una ruta de `/bff/api/*`
- **THEN** la respuesta lleva los mismos cuatro headers

#### Scenario: Un archivo estático
- **WHEN** el navegador pide un archivo de `/_next/static/*`
- **THEN** la respuesta lleva los mismos cuatro headers

#### Scenario: HSTS solo con HTTPS
- **WHEN** la web corre con `SESSION_COOKIE_SECURE=true`
- **THEN** las respuestas llevan `Strict-Transport-Security: max-age=63072000; includeSubDomains`
- **AND** con `SESSION_COOKIE_SECURE=false` ninguna respuesta lo lleva

#### Scenario: La web no se puede incrustar
- **WHEN** otro sitio intenta mostrar la web dentro de un `iframe`
- **THEN** el navegador se niega

#### Scenario: Las mutaciones siguen funcionando
- **WHEN** el usuario inicia sesión en un navegador real
- **THEN** la Server Action de inicio de sesión se acepta con la política de referencia vigente

### Requirement: WEB-39 Content-Security-Policy con nonce
La web SHALL enviar en cada respuesta de página una `Content-Security-Policy` con un nonce distinto por petición, generado en el proxy de Next.js, con `default-src 'self'`; `script-src` con `'self'`, ese nonce y `'strict-dynamic'`, y sin `'unsafe-inline'`; `style-src` con `'self'` y ese nonce; `img-src 'self' data: blob:`; `font-src 'self'`; `connect-src 'self'`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'` y `frame-ancestors 'none'`. `'unsafe-eval'` MUST aparecer solo en desarrollo. `upgrade-insecure-requests` MUST aparecer solo cuando la cookie de sesión es segura. El nonce MUST llegar a los scripts que Next.js genera. Ninguna pantalla del producto, pública o autenticada, MUST producir una violación de la política en el navegador, ni con el servidor de desarrollo ni con la compilación de producción. El proxy MUST seguir informando la ruta pedida (WEB-22).

#### Scenario: Nonce distinto por petición
- **WHEN** el navegador hace dos peticiones de página
- **THEN** cada respuesta lleva una `Content-Security-Policy` con un nonce distinto
- **AND** los scripts de la página llevan ese mismo nonce

#### Scenario: Directivas de producción
- **WHEN** la web corre en producción con HTTPS
- **THEN** la política incluye `upgrade-insecure-requests` y no incluye `'unsafe-eval'` ni `'unsafe-inline'` en `script-src`

#### Scenario: Directivas de desarrollo
- **WHEN** la web corre con `next dev`
- **THEN** `script-src` incluye `'unsafe-eval'`

#### Scenario: HTTP en local
- **WHEN** la web corre con `SESSION_COOKIE_SECURE=false`
- **THEN** la política no incluye `upgrade-insecure-requests`

#### Scenario: Script en línea sin nonce
- **WHEN** una página recibe un `<script>` en línea sin el nonce
- **THEN** el navegador no lo ejecuta

#### Scenario: Recorrido sin violaciones
- **WHEN** una prueba en navegador real visita las pantallas públicas (inicio de sesión, registro y verificación) y las autenticadas (resumen, movimientos, beneficiarios, transferir y programadas)
- **THEN** no hay mensajes de consola de violación ni eventos `securitypolicyviolation`

#### Scenario: Compilación de producción
- **WHEN** la misma prueba corre contra `next start` de una compilación de producción
- **THEN** inicia sesión, navega y termina sin violaciones

#### Scenario: Ruta pedida
- **WHEN** el navegador pide `/accounts/abc/movements?type=DEPOSIT`
- **THEN** el layout protegido sigue recibiendo esa ruta para armar el regreso tras iniciar sesión (WEB-22)

### Requirement: WEB-40 Un 429 no cierra la sesión ni se reintenta
Cuando la API responde `429 RATE_LIMITED`, la web SHALL conservar la sesión del servidor y la cookie, y MUST NOT repetir la llamada por su cuenta. Si el `429` ocurre al renovar el access token, la petición que lo necesitaba MUST fallar con un error de esa petición y la siguiente MUST poder renovar. Si ocurre al crear, confirmar o reenviar el código de una transferencia, la pantalla SHALL mostrar el mensaje de `RATE_LIMITED` del paquete de diseño con la espera indicada en `Retry-After`, y la transferencia MUST NOT quedar marcada como enviada ni como fallida.

#### Scenario: 429 al renovar
- **WHEN** la API responde `429` al renovar el access token de una sesión
- **THEN** la sesión y la cookie siguen vigentes
- **AND** la web hace una sola llamada a `refreshSession`

#### Scenario: La renovación se recupera
- **WHEN** después de un `429` al renovar pasa el tiempo de `Retry-After` y llega otra petición de la misma sesión
- **THEN** la web renueva el access token y la petición se completa

#### Scenario: 429 al crear una transferencia
- **WHEN** la API responde `429` con `Retry-After: 30` a `createTransfer`
- **THEN** la web hace una sola llamada a la API
- **AND** la pantalla muestra el mensaje de `RATE_LIMITED` con la espera de 30 segundos

#### Scenario: 429 al confirmar o reenviar el código
- **WHEN** la API responde `429` a `confirmTransfer` o a `resendTransferOtp`
- **THEN** la pantalla muestra el mensaje de `RATE_LIMITED` con la espera
- **AND** la transferencia sigue pendiente de confirmación
