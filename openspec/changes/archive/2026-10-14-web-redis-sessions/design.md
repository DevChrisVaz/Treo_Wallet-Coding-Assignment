## Context

`web-app` definió el puerto `SessionStore` (D2) con dos implementaciones previstas: un `Map` en `globalThis` para local y Redis (ElastiCache) para AWS. Solo existe la primera. El `Map` sobrevive a la recarga de módulos de `next dev`, pero no a un reinicio del proceso, y el servidor de la web se reinicia seguido en desarrollo (cada `next build` + `next start`). Cuando eso pasa, el refresh token de la sesión se pierde con el proceso: sigue vigente en la API, pero nadie lo tiene, y el usuario vuelve al inicio de sesión.

La sesión se lee en cada petición con sesión (`currentSession` hace `get` y `touch`), se reescribe al renovar los tokens (`refresh` hace `get` y `set` con el par nuevo) y se borra al cerrar sesión o cuando la API revoca el refresh.

## Goals / Non-Goals

**Goals:**
- Que las sesiones sobrevivan a reiniciar la web en desarrollo, con la misma implementación que AWS.
- Misma expiración que WEB-03, verificada con la misma suite en las dos implementaciones.
- Que renovar el plazo nunca pise los tokens de una renovación concurrente ni reviva una sesión cerrada.

**Non-Goals:**
- Llevar a Redis el *single-flight* de la renovación (sigue por proceso; con varias instancias lo absorbe la gracia de 30 s de la API, D2 de `web-app`).
- Mover a Redis el rate limiting de la API.
- Hacer obligatorio Redis: sin `REDIS_URL` todo sigue como hoy.

## Decisions

### D1. `docker-compose.yml` propio de `/web`
Redis va en `web/docker-compose.yml` (proyecto `treo-web`), no en el de `/api`. La web es el único consumidor y los proyectos se separarán en repositorios propios. Se publica solo en `127.0.0.1:6379` porque no tiene contraseña; usa AOF (`--appendonly yes`) con un volumen para que las sesiones sobrevivan también a recrear el contenedor; imagen `redis:7.2-alpine`, de la misma versión mayor que ElastiCache for Redis OSS.

*Alternativas descartadas:*
- **Agregarlo al `docker-compose.yml` de `/api`.** Un solo `docker compose up`, pero la API cargaría una dependencia que solo usa la web.
- **Un `docker-compose.yml` en la raíz.** Sería el primer archivo compartido entre proyectos.

### D2. Se elige la implementación con `REDIS_URL`
`REDIS_URL` es opcional y se valida como `redis://` o `rediss://` (TLS, como en ElastiCache con cifrado en tránsito). Vacía o ausente, `sessionStore()` devuelve el `Map` en memoria. Las pruebas unitarias, el build y los e2e con la API simulada no necesitan Redis.

*Alternativa descartada:* exigir Redis siempre. Obligaría a levantar Docker para correr las pruebas unitarias de la web y el e2e con la API simulada.

### D3. Un hash por sesión con TTL
Llave `treo:web:session:<sid>` (el prefijo separa las sesiones de los contadores que compartirán el mismo Redis en AWS). Campos: `data` (la sesión en JSON, sin `lastSeenAt`), `lastSeenAt` y `deadline` (vencimiento del refresh token en milisegundos). El TTL es el plazo menor entre `lastSeenAt` + inactividad y `deadline`, así que Redis borra solo las sesiones vencidas. `set` escribe todo en una transacción (`MULTI`: `DEL`, `HSET`, `PEXPIRE`); `get` vuelve a comprobar el vencimiento con el reloj del servidor web, como la implementación en memoria.

*Alternativa descartada:* un string con el JSON completo. Renovar el plazo tendría que leer y reescribir toda la sesión, y una renovación de tokens que ocurriera entre la lectura y la escritura se perdería (D4).

### D4. `touch` atómico con un script Lua
`touch` actualiza `lastSeenAt` y recalcula el TTL en un solo script: si la llave no existe, no hace nada; si el plazo ya venció, la borra. Así:
- nunca reescribe `data`, de modo que no puede devolver a la sesión un refresh token ya usado (si lo hiciera, la siguiente renovación sería reuso y la API revocaría la familia, IDN-12);
- no vuelve a crear una sesión que expiró o se cerró entre la lectura y la escritura, como pasaría con `HSET` + `PEXPIRE` sueltos.

*Alternativa descartada:* `WATCH` + `MULTI` con reintentos. Funciona, pero con más idas y vueltas por petición y un ciclo de reintento que probar.

### D5. Una conexión por proceso que falla rápido
El cliente es `redis` (node-redis, el cliente oficial). Hay una conexión por proceso en `globalThis`, como el `Map`, para que la recarga de módulos de `next dev` no abra conexiones nuevas. Se conecta al primer uso, no al importar, para que `next build` no necesite Redis. Con `disableOfflineQueue`, los comandos fallan de inmediato mientras no hay conexión, en lugar de quedar en cola. Al arrancar, la conexión se rinde tras dos reintentos y el siguiente uso vuelve a intentar; ya conectada, se reconecta siempre con espera creciente de hasta 2 s. Con la estrategia por defecto, `connect()` queda pendiente para siempre si Redis no está y las páginas se quedarían colgadas (comprobado con node-redis 5.12). Los errores de conexión se registran en una línea JSON.

Si Redis falla, el error sube: `currentSession` lo lanza, el layout protegido responde con error del servidor y la cookie se conserva.

*Alternativas descartadas:*
- **Volver al `Map` si Redis falla.** Las sesiones dependerían de qué almacén respondió en cada petición y el usuario saldría sin motivo visible.
- **`ioredis`.** Es igual de capaz, pero el proyecto de Redis recomienda node-redis para código nuevo.

### D6. Pruebas contra Redis real
La suite de WEB-03 se convierte en una suite común (`test/support/session-store-contract.ts`) que reciben las dos implementaciones: la de memoria con reloj falso y la de Redis con tiempo real y un plazo de inactividad de 1 s. La de Redis agrega las pruebas propias (TTL, `touch` concurrente con `set` y con `delete`, reinicio, Redis caído). Corre cuando existe `TEST_REDIS_URL`, que debe apuntar a una base distinta de la 0, la de las sesiones de desarrollo; en CI la prueba falla si falta la variable, para que no se salte en silencio. Cada archivo borra solo sus propias llaves, nunca la base completa: los archivos corren en paralelo y un `FLUSHDB` de uno borraba la sesión que otro estaba esperando (visto con `MONITOR` al correr la suite completa).

*Alternativa descartada:* un Redis simulado en memoria. No ejecuta Lua ni los TTL reales, que es justo lo que hay que probar.

## Risks / Trade-offs

- **[Riesgo] Las pruebas de Redis dependen del tiempo real.** Mitigación: los márgenes son de al menos 300 ms sobre un plazo de 1 s y las esperas suman unos 4 s.
- **[Riesgo] Con Redis caído no se puede usar la web.** Es intencional (D5): falla visible en vez de sesiones intermitentes. En desarrollo basta con `docker compose up -d` o con quitar `REDIS_URL`.
- **[Trade-off] Un comando más por petición que con el `Map`.** `get` + `touch` son dos idas y vueltas a un Redis local; no se nota frente a la llamada a la API.
