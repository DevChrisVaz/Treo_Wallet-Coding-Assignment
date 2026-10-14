# TreoWallet · web

Panel web de TreoWallet: Next.js (App Router) como BFF (_Backend for Frontend_) de la API. El navegador nunca recibe los tokens: la sesión vive en el servidor de la web y el navegador solo tiene una cookie con un id opaco.

- Especificación: `openspec/changes/web-app/` (capability `web-app`, requisitos WEB-01 a WEB-23) y `openspec/changes/account-statements/` (WEB-32, descarga del estado de cuenta). Decisiones y alternativas en su `design.md`.
- Consume `@devchrisvaz/wallet-contract` (cliente tipado, validadores Zod, `formatMXN`) y `@devchrisvaz/wallet-design-tokens` (tokens para Tailwind v4, estados, movimientos y textos de error).

## Cómo funciona

```mermaid
flowchart LR
  N[Navegador] -- "Server Actions (mutaciones)" --> W[Web: Next.js]
  N -- "GET /bff/api/... (lecturas)" --> W
  W -- "Bearer, X-Request-Id, X-Forwarded-For, Idempotency-Key" --> A[API :4000]
  W --- S[(SessionStore: tokens)]
```

- **Mutaciones** con Server Actions (`app/actions/`): validan con los esquemas del contrato, exigen la sesión y devuelven `{ ok, data }` o `{ ok: false, problem }`. Next.js rechaza las que llegan de otro `Origin`.
- **Lecturas** por el proxy `GET /bff/api/[...path]`, con lista blanca de rutas y destino fijo en `API_BASE_URL`. `GET /bff/api/session` responde con el usuario de la sesión sin llamar a la API.
- **Estado de cuenta** (WEB-32): en la pantalla de movimientos, un selector con el mes en curso ("(en curso)") y los 12 anteriores, con el mes anterior por defecto, y el botón "Descargar PDF". La descarga pasa por el mismo proxy (`accounts/<id>/statements/<AAAA-MM>`, solo GET): para esa ruta el proxy pide `application/pdf`, entrega el cuerpo de la API sin tocar sus bytes y copia `Content-Type`, `Content-Disposition`, `Content-Length` y `Retry-After`. El navegador guarda el archivo con el nombre que propone la API (`estado-de-cuenta-2026-09-0015.pdf`). Mientras descarga, el botón queda ocupado y no acepta otro clic; un error muestra el mensaje de su `code` sin salir de la pantalla (en `RATE_LIMITED`, con la espera). El control es un componente aparte (`components/accounts/StatementDownload.tsx`) para que el rediseño lo reubique sin cambiarlo.
- **Sesión** en un `Map` en memoria (en AWS, Redis): expira tras `SESSION_IDLE_MINUTES` sin actividad o al vencer el refresh token; el access token se renueva una sola vez por sesión aunque lleguen peticiones simultáneas.
- **Transferencias**: la llave de idempotencia se genera en el navegador al pasar a la confirmación y se reutiliza solo al reintentar tras un fallo de red o un `5xx`; el botón se bloquea desde el primer clic.
- **Interfaz**: componentes cliente con TanStack Query; formularios con react-hook-form y los validadores del contrato; estilos solo con las utilidades de los tokens (la paleta por defecto de Tailwind no existe); mensajes de error de `problemMessage` del paquete de diseño.

| Carpeta       | Contenido                                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------------------------- |
| `app/`        | Rutas: `(public)` (login, registro, verificación), `(app)` (protegidas en el layout), `bff/` y `actions/`      |
| `components/` | `ui/` (inventario del sistema de diseño), pantallas por dominio, estados de carga y error                      |
| `lib/server/` | Solo servidor (`server-only`): entorno, sesión, cookie, contexto de petición, cliente de API, acciones y proxy |
| `lib/client/` | Lecturas, TanStack Query, mensajes por `code`, `unwrap`, flujo de transferencia y llave de idempotencia        |
| `test/`       | Datos de ejemplo del contrato, API simulada con `fetch`, sustitutos de `next/headers` y `next/navigation`      |

## Requisitos

- Node 24 para las herramientas (el servidor funciona desde Node 20.9).
- `/contract` y `/design-tokens` compilados (la web los instala como copia).
- Para usar la web: la API en `http://localhost:4000`, con PostgreSQL y Mailpit de su `docker compose` (ver el README de `/api`).

## Instalación

```bash
(cd ../contract && npm ci && npm run build)
(cd ../design-tokens && npm ci && npm run build)
npm ci
```

**`install-links`.** `.npmrc` tiene `install-links=true`: npm instala `file:../contract` y `file:../design-tokens` como copia de lo que cada paquete publica (su `dist`), con sus dependencias, igual que si vinieran de un registro. Por eso hay que compilarlos antes, y **un cambio en `/contract` o en `/design-tokens` no llega solo**: vuelve a compilar el paquete y corre `npm install` aquí. Sin `install-links`, npm crearía un enlace simbólico y no instalaría las dependencias del paquete.

## Variables de entorno

Todas son del servidor (ninguna lleva `NEXT_PUBLIC_`) y se validan con Zod al arrancar: una inválida detiene `next dev` o `next start` con un error que la nombra. Copia `.env.example` a `.env.local`.

| Variable                | Por defecto                                                            | Uso                                                                                                                                                                     |
| ----------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `API_BASE_URL`          | `http://localhost:4000` en desarrollo; **obligatoria** en `next start` | Origen de la API, sin ruta. El destino de todas las llamadas; nunca se toma de la petición                                                                              |
| `ALLOWED_ORIGINS`       | vacío (solo el propio origen)                                          | Orígenes adicionales, separados por comas, desde los que se aceptan Server Actions (la web detrás de un proxy con otro dominio). Se aplica al arrancar                  |
| `SESSION_COOKIE_SECURE` | `true` en producción, `false` en desarrollo                            | `true` detrás de HTTPS: la cookie se llama `__Host-sid` y lleva `Secure`. Safari rechaza cookies `Secure` en `http://localhost`, por eso en local es `sid` sin `Secure` |
| `SESSION_IDLE_MINUTES`  | `15`                                                                   | Minutos de inactividad tras los que expira la sesión                                                                                                                    |

El build (`next build`) no necesita `API_BASE_URL`: el servidor la lee en cada petición.

## Correr en local

1. Levanta la API en el puerto 4000 con su base de datos y Mailpit.
2. `npm run dev` y abre `http://localhost:3000`. Si el puerto 3000 está ocupado: `npm run dev -- -p 3100`.
3. Regístrate en `/register`; el código de verificación llega a Mailpit (`http://localhost:8025`). Al verificar el correo se abren las cuentas Principal y Ahorro en $0.00; para tener saldo, usa el fondeo de la API (`db:fund`).
4. Las transferencias de más de $10,000.00 piden un código que también llega a Mailpit.

Para probar el build de producción por `http` en local: `npm run build` y luego `API_BASE_URL=http://localhost:4000 SESSION_COOKIE_SECURE=false npm start`.

La sesión vive en la memoria del proceso: reiniciar el servidor cierra todas las sesiones.

## Scripts

| Script                            | Qué hace                                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------------------- |
| `npm run dev`                     | Servidor de desarrollo                                                                         |
| `npm run build` / `npm start`     | Build de producción y servidor                                                                 |
| `npm test`                        | Pruebas con Vitest (`npm run test:watch` en modo observación)                                  |
| `npm run typecheck`               | `next typegen` y `tsc --noEmit`                                                                |
| `npm run lint`                    | ESLint, sin advertencias permitidas; incluye la regla que prohíbe `parseFloat` y `Number(...)` |
| `npm run format` / `format:check` | Prettier                                                                                       |

## Pruebas

```bash
npm test
```

Ninguna prueba necesita la API: el BFF se prueba con `fetch` simulado (`test/support/fake-api.ts`) y sustitutos de `next/headers`, y las pantallas con el módulo de acciones y las lecturas simulados. Hay dos proyectos de Vitest: `*.test.ts` corre en Node (BFF, configuración y lógica) y `*.test.tsx` en jsdom con Testing Library y `vitest-axe`. El título de cada prueba empieza con el ID del requisito que verifica (`WEB-17 …`, `DSG-09 …`).

El contraste no se puede medir en jsdom; se verificó con Lighthouse (ver abajo).

## Avisos conocidos

- `npm audit` reporta vulnerabilidades altas de `braces` que llegan por `eslint-config-next` (`fast-glob` → `micromatch`). Solo afectan a herramientas de desarrollo: `npm audit --omit=dev` está limpio. La corrección que propone npm baja `eslint-config-next` a la versión 14.
- ESLint queda en la versión 9 porque los plugins de `eslint-config-next` 16.4 (react, import, jsx-a11y) declaran ESLint ≤ 9.
- `vitest-axe` está en `1.0.0-pre.5`, la versión con tipos para Vitest ≥ 1; la estable (0.1.0) es de 2022.
- En desarrollo, Next.js registra los argumentos de las Server Actions; está desactivado (`logging.serverFunctions: false`) para que contraseñas y códigos no lleguen a los logs.

## Verificaciones manuales

Lo que las pruebas automáticas no pueden comprobar en jsdom se verificó en un navegador real (Chrome, con el MCP de Chrome DevTools) el 13 de octubre de 2026.

**Entorno.** Build de producción (`npm run build` y `next start -p 3100`, sin el overlay de desarrollo de Next.js, que captura el foco en `next dev`) con `SESSION_COOKIE_SECURE=false`. La primera vez la API real no estaba disponible: se usó una API simulada en el puerto 4100 con las rutas, los cuerpos y los códigos de `contract/openapi.yaml` (no se versiona). Las dos verificaciones de accesibilidad se repitieron después con la API real (ver "Repetición con la API real"); la de origen no depende de la API.

### Transferencia solo con teclado (WEB-23)

Con Tab, Shift+Tab, Enter, Espacio y las flechas, sin ratón:

| Paso                                                                                                                                               | Resultado                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Abrir `/transfers/new` sin sesión                                                                                                                  | Redirige a `/login?next=%2Ftransfers%2Fnew`                                                                                      |
| Tab desde el inicio de la página                                                                                                                   | El primer foco es "Saltar al contenido", visible, con el anillo de 2 px `#1C4B42` y 2 px de separación; Enter lleva al contenido |
| Correo, Tab, contraseña, Enter                                                                                                                     | Inicia sesión y vuelve a `/transfers/new`                                                                                        |
| Cuenta de origen (flecha abajo), Tab al destino "Un beneficiario", Tab al beneficiario (flecha abajo), monto `15,000`, concepto, referencia, Enter | Pasa a la confirmación; el foco queda en "Confirma la transferencia" y el resumen muestra $15,000.00                             |
| Tab a "Enviar", Espacio                                                                                                                            | Pasa al código; el foco queda en "Ingresa el código", con el destino enmascarado y la hora de expiración                         |
| Código incorrecto, Enter                                                                                                                           | La alerta "El código no es correcto. Te quedan 2 intentos." recibe el foco                                                       |
| Tab al código, código correcto, Enter                                                                                                              | Comprobante "Completada"; el foco queda en "Transferencia enviada"                                                               |
| Volver al resumen                                                                                                                                  | Saldo de Principal en $10,000.00 y "Te quedan $23,000.00 hoy": las cuentas se volvieron a consultar                              |

En todos los pasos el foco fue visible. Observaciones:

- Tras una navegación del lado del cliente el foco queda en el documento: el siguiente Tab va al primer enlace de la navegación y Shift+Tab llega a "Saltar al contenido".
- Durante la verificación la sesión superó los 15 minutos de inactividad: al pulsar "Enviar", la web llevó a `/login?next=%2Ftransfers%2Fnew&reason=expired` con "Tu sesión expiró" y la API no recibió la creación (WEB-03). Con la cookie de una sesión que ya no existía, el layout pasó por `/bff/session/expired`, que borró la cookie.
- La cookie `sid` no es visible para JavaScript (`document.cookie` vacío) y ni el HTML ni el almacenamiento del navegador contienen tokens (WEB-01).

### Contraste y accesibilidad con Lighthouse (WEB-23)

Categoría de accesibilidad de Lighthouse, que incluye `color-contrast`. En modo _snapshot_ la auditoría se hizo después de cargar los datos o de enviar el formulario vacío, con los errores a la vista.

| Pantalla                                            | Modo                            | Dispositivo | Accesibilidad |
| --------------------------------------------------- | ------------------------------- | ----------- | ------------- |
| `/login?reason=expired`                             | navegación                      | móvil       | 100           |
| `/register` con errores en los seis campos          | snapshot                        | móvil       | 100           |
| `/` (resumen)                                       | navegación y snapshot con datos | escritorio  | 100           |
| `/transfers/new` con errores en cinco campos        | snapshot                        | escritorio  | 100           |
| `/beneficiaries/new` con errores en los tres campos | snapshot                        | escritorio  | 100           |
| `/accounts/{id}/movements` con 20 movimientos       | snapshot                        | móvil       | 100           |

`color-contrast` pasó en todas, sin auditorías fallidas.

### Repetición con la API real

El mismo día, con la API real (puerto 4000, PostgreSQL y Mailpit) y el build de producción de la web en `127.0.0.1:3100`:

- **Solo con teclado:** inicio de sesión y transferencia de $5.00 de Principal a Ahorro hasta el comprobante, sin ratón. Con Tab real, "Continuar" muestra el anillo de 2 px `#1C4B42` con 2 px de separación. El anillo aparece con una transición de 150 ms (`transition-colors` también anima `outline-color`), así que una captura tomada justo al enfocar puede no mostrarlo.
- **Lighthouse (accesibilidad):** 100, sin auditorías fallidas, en `/login`, `/`, `/accounts/{id}/movements`, `/beneficiaries` y `/transfers/new`.

### Prueba de extremo a extremo contra la API real

Se recorrieron en el navegador todas las funciones con los usuarios del seed:

- inicio y cierre de sesión, y rutas protegidas;
- historial con filtros y paginación;
- beneficiarios con sus cuatro rechazos;
- transferencias propias y a terceros, con el doble clic y el reintento tras perder la respuesta (una sola transferencia, misma llave);
- OTP: umbral, código incorrecto, reenvíos con su tope, vencimiento y agotamiento de intentos;
- límite diario;
- registro con verificación por correo, y registro con un correo existente (mismo mensaje, aviso al dueño);
- acceso a datos ajenos por URL;
- límite de intentos de inicio de sesión.

Las cifras se verificaron contra la base de datos. Encontró un error: con "Desde" posterior a "Hasta", el historial mostraba "Revisa los campos marcados." sin marcar ningún campo. Se corrigió (tarea 6.3 de `web-app`) y se comprobó en el navegador.

### Mutación con un `Origin` ajeno (WEB-06)

La protección de origen de las Server Actions es del framework (compara `Origin` con `Host` y acepta los hosts de `serverActions.allowedOrigins`); las pruebas solo cubren la configuración. Se verificó a mano con `curl` contra `next start`, invocando la acción `createBeneficiary` con el header `Next-Action` y la cookie de una sesión válida, y contando en el registro de la API simulada las llamadas a `POST /beneficiaries`:

```sh
curl -X POST http://localhost:3100/beneficiaries/new \
  -H 'Origin: https://evil.example.com' -H 'Next-Action: <id de createBeneficiary>' \
  -H 'Content-Type: text/plain;charset=UTF-8' -H 'Cookie: sid=<id de sesión>' \
  --data '[{"name":"Mario Soto","alias":"Mario","clabe":"032180000118359780"}]'
```

El id de la acción está en `.next/server/server-reference-manifest.json` tras el build.

| `Origin`                            | `ALLOWED_ORIGINS`            | Respuesta                                                                                                                           | Llamadas a la API |
| ----------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `https://evil.example.com`          | vacío                        | `500`; el servidor registra "`x-forwarded-host` … does not match `origin` … Aborting the action" e "Invalid Server Actions request" | 0                 |
| `http://localhost:3100` (el propio) | vacío                        | `200` con el beneficiario                                                                                                           | 1                 |
| `https://wallet.example.com`        | `https://wallet.example.com` | `200` con el beneficiario                                                                                                           | 1                 |
| `https://evil.example.com`          | `https://wallet.example.com` | `500`, acción abortada                                                                                                              | 0                 |

`ALLOWED_ORIGINS` se aplica al arrancar `next start`, sin volver a compilar. La respuesta del rechazo no incluye detalles, solo un `digest`.
