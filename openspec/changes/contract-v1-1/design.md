## Context

`contract-v1` (archivado) publica `@devchrisvaz/wallet-contract` 1.0.1 con salida ESM y CommonJS generada por tsup (esbuild). Web y móvil lo consumen como ESM; nadie usa todavía la salida CommonJS. Los dos huecos los encontraron los subagentes de `web-app` y `mobile-app` (D18 de `web-app`, N1 de `mobile-app`).

**Causa del fallo de CommonJS.** `src/client.ts` hace `import createClient from 'openapi-fetch'`. En la salida CommonJS, esbuild lo traduce a `__toESM(require('openapi-fetch'), 1)`. El `1` aplica la semántica de Node porque el paquete es `"type": "module"`: Node ignora la marca `__esModule`, y `default` es el objeto completo del módulo. La salida CommonJS de openapi-fetch exporta el cliente en `exports.default`, así que la función queda un nivel más abajo (`default.default`) y la llamada falla. La prueba de humo solo comprobaba `typeof createApiClient === 'function'`.

## Goals / Non-Goals

**Goals:**
- Que el cliente creado con `require` haga peticiones, y que una prueba lo compruebe.
- Que `ProblemError` exponga `retryAfter`, con una sola interpretación del header para web y móvil.
- Retirar los middlewares de `Retry-After` de los clientes.

**Non-Goals:**
- Cambiar la API HTTP o el `openapi.yaml`, salvo `info.version`.
- Interpretar `Retry-After` como fecha HTTP: el contrato lo define como entero de segundos (`RetryAfter`, mínimo 1).
- Exponer otros headers en el error.

## Decisions

### D1. Interop explícito con el `default` de openapi-fetch
`src/client.ts` importa el módulo completo y toma la función de `default` o, si `default` es el objeto del módulo, de `default.default`. Un comentario explica por qué.

*Alternativas descartadas:*
- **Empaquetar openapi-fetch dentro del build** (`noExternal`). Duplica su código en cada consumidor y los tipos siguen dependiendo del paquete externo.
- **Cambiar el paquete a `"type": "commonjs"`.** Afecta a los scripts y a la configuración de las herramientas solo para corregir una importación.
- **Quitar la salida CommonJS.** Rompe CTR-15.

### D2. `retryAfter` se lee en `toProblemError`
`toProblemError` ya recibe la `Response`. Ahí lee `Retry-After` y lo pasa al constructor de `ProblemError` como cuarto parámetro opcional, para no romper a quien ya construye el error con tres. Solo un entero positivo escrito con dígitos (`/^[0-9]+$/`, seguro en `Number`, al menos 1) se acepta como `retryAfter`; cualquier otro valor da `undefined` y el cliente muestra el mensaje sin la espera. Se lee en cualquier respuesta de error, no solo en `429`, porque el header tiene el mismo significado en todas.

### D3. Versión 1.1.0
CTR-02 ata la versión del paquete a `info.version`. El cambio agrega un campo opcional al error, así que es menor. Se suben `package.json` y `info.version` a 1.1.0, aunque las rutas no cambian.

### D4. Los clientes leen `error.retryAfter`
Web y móvil reinstalan el paquete y reemplazan su middleware por `error.retryAfter`. Sus pruebas de WEB-12 y MOB-01 ya simulan un `429` con `Retry-After` y deben seguir pasando sin cambios de comportamiento.

## Risks / Trade-offs

- **[Riesgo] El interop depende de la forma de la salida CommonJS de openapi-fetch.** Mitigación: la prueba de humo crea un cliente y hace una petición con `import` y con `require`, y falla si una actualización cambia esa forma.
- **[Riesgo] La rama de la API se integra con 1.0.1 en su lockfile.** Mitigación: al integrarla se reinstala el paquete en `/api` y se vuelven a correr sus pruebas.
