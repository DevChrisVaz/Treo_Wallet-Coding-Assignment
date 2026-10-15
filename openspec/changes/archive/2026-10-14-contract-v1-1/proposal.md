## Why

Al implementar `web-app` y `mobile-app` aparecieron dos huecos en el paquete del contrato:

- **La salida CommonJS no funciona.** `require('@devchrisvaz/wallet-contract').createApiClient(...)` falla con "import_openapi_fetch.default is not a function". La prueba de humo solo comprueba que la función exista, no que funcione, y por eso no lo detectó. Hoy no afecta a ningún cliente, porque web y móvil usan la salida ESM, pero el paquete anuncia `require` (CTR-15).
- **`ProblemError` pierde `Retry-After`.** El cliente lanza el error dentro de su middleware y el error no conserva los headers. La web (WEB-12) y la app (MOB-01) necesitan los segundos de espera de un `429` y cada una los rescata con un middleware propio, con dos formas distintas de interpretar el header.

## What Changes

- La salida CommonJS crea un cliente que funciona. La prueba de humo crea un cliente y hace una petición con `import` y con `require`.
- `ProblemError` expone `retryAfter`: los segundos de `Retry-After` de la respuesta, si es un entero positivo válido; si no, `undefined`.
- Contrato y paquete pasan a 1.1.0. La API HTTP no cambia; la versión es una sola para ambos (CTR-02) y el cambio agrega un campo opcional al error del cliente.
- Web y móvil dejan su middleware de `Retry-After` y leen `error.retryAfter`.

**Proyectos que toca:** `/contract`, `/web` y `/mobile`. La API no cambia de comportamiento; solo actualiza su copia del paquete al integrar.

**Historias de usuario:** ninguna nueva. Corrige el soporte de la espera tras demasiados intentos de inicio de sesión (WEB-12, MOB-01).

## Capabilities

### New Capabilities
<!-- Ninguna. -->

### Modified Capabilities
- `api-contract`: el error tipado incluye `retryAfter` (CTR-07) y la salida CommonJS crea un cliente que funciona (CTR-15).

## Impact

- **`/contract`:** `src/errors.ts`, la configuración del build o la importación de `openapi-fetch`, la prueba de humo, la versión (1.1.0) y el README.
- **`/web`:** se elimina el middleware `problemWithRetryAfter` y `retryAfterOf` de `lib/server/api-client.ts`; las Server Actions toman `retryAfter` del error.
- **`/mobile`:** se elimina `retryAfterMiddleware` y el `WeakMap` de `src/api/client.ts`; el inicio de sesión toma `retryAfter` del error.
- **`/api`:** al integrar su rama, reinstala el paquete para que su lockfile refleje 1.1.0.
- **Riesgo:** bajo. Agregar un campo opcional no rompe a ningún consumidor.
