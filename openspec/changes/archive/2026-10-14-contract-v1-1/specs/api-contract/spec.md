## MODIFIED Requirements

### Requirement: CTR-07 Errores problem+json como error tipado
Cuando la API responda con `application/problem+json`, el cliente SHALL entregar al consumidor un error tipado que exponga `status`, `code`, `title`, `detail`, `requestId` y las extensiones (`errors`, `transferId`, `transferStatus`, `remaining`, `attemptsRemaining`). El campo `code` MUST tiparse como la unión de los valores de `ProblemCode` del contrato. El error MUST exponer también `retryAfter`: los segundos del header `Retry-After` cuando la respuesta lo trae como entero positivo, y `undefined` en cualquier otro caso. Los fallos sin respuesta HTTP (red caída, timeout) MUST distinguirse de los errores de la API, porque son los únicos que el consumidor puede reintentar con la misma llave.

#### Scenario: Saldo insuficiente
- **WHEN** la API responde 422 con `code` `INSUFFICIENT_FUNDS` y un `transferId`
- **THEN** el consumidor recibe un error tipado con `code === "INSUFFICIENT_FUNDS"` y el `transferId`

#### Scenario: Pérdida de red
- **WHEN** la petición falla sin recibir respuesta HTTP
- **THEN** el consumidor recibe un error de red distinguible de un error de la API

#### Scenario: Respuesta de error que no es problem+json
- **WHEN** la API o un intermediario responde 502 con un cuerpo HTML
- **THEN** el consumidor recibe un error tipado con `code` `INTERNAL_ERROR` y el `status` original, sin exponer el cuerpo recibido

#### Scenario: Demasiados intentos con Retry-After
- **WHEN** la API responde 429 con `code` `RATE_LIMITED` y el header `Retry-After: 300`
- **THEN** el consumidor recibe un error tipado con `retryAfter === 300`

#### Scenario: Retry-After ausente o inválido
- **WHEN** la respuesta de error no trae `Retry-After`, o lo trae como `0`, `-5`, `1.5`, `abc` o una fecha HTTP
- **THEN** el error tipado tiene `retryAfter === undefined`

### Requirement: CTR-15 Paquete agnóstico de entorno
El paquete SHALL funcionar sin cambios en Node.js 20 o superior y en el motor JavaScript de React Native. El paquete MUST NOT depender de APIs exclusivas de Node.js ni de React Native, y MUST publicarse con salida ESM, CommonJS y declaraciones de tipos, con los campos de entrada clásicos además del mapa de exports. Ambas salidas MUST funcionar, no solo resolver: el cliente creado con `require` MUST hacer peticiones igual que el creado con `import`.

#### Scenario: Uso desde Node
- **WHEN** un proyecto Node 20 importa el paquete con `import` y con `require`
- **THEN** ambas formas resuelven y exponen las mismas funciones

#### Scenario: Cliente creado con require
- **WHEN** un proyecto Node 20 carga el paquete con `require`, crea un cliente con `createApiClient` y hace una petición con un `fetch` propio
- **THEN** la petición llega a ese `fetch` con la URL de la ruta y el cliente devuelve la respuesta, igual que con `import`

#### Scenario: Sin APIs de Node
- **WHEN** se inspecciona el paquete construido
- **THEN** no contiene importaciones de módulos internos de Node.js
