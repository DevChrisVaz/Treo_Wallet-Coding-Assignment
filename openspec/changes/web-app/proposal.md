## Why

El enunciado pide un panel web completo en React que consuma la misma API que la app móvil: login, resumen de cuentas, historial con filtros y paginación, alta de beneficiarios y flujo de transferencia con confirmación y comprobante. Al tratarse de dinero, la web no debe exponer tokens al navegador ni permitir que un doble clic o un reintento produzca dos transferencias, así que se construye como un **BFF** (Backend for Frontend) en Next.js.

## What Changes

- Nuevo proyecto **`/web`** en Next.js (App Router) con TypeScript estricto, independiente de los demás: lockfile propio, CI propio y dependencia del contrato vía `file:../contract` con `install-links=true`.
- **BFF con sesión en el servidor**: el navegador solo recibe una cookie con un id opaco; el access y el refresh token viven en un `SessionStore` del servidor (memoria en local, Redis en AWS). Expiración por 15 minutos de inactividad, refresh de una sola vez por sesión y logout que revoca la familia del refresh.
- **Mutaciones con Server Actions** (login, registro, verificación de correo, reenvío, logout, alta de beneficiario, creación, confirmación y reenvío de OTP de transferencias) que validan con los esquemas Zod del paquete de contrato y devuelven el resultado como valor (`ok` o `problem`), nunca lanzando errores esperados.
- **Lecturas con un proxy GET** (`/bff/api/...`) con lista blanca de rutas y host fijo, que adjunta el Bearer y reenvía `X-Forwarded-For`, `X-Request-Id` e `Idempotency-Key`.
- **Pantallas**: login, registro, verificación de correo, resumen de cuentas con límite diario restante, historial con selector de cuenta, filtros y "cargar más", beneficiarios (lista y alta) y transferencia (formulario → confirmación → OTP → comprobante), con estados de carga, vacío y error en cada una.
- **Idempotencia en el cliente**: la llave se genera una sola vez por intento; el botón se deshabilita mientras se envía.
- **Accesibilidad básica**: teclado, etiquetas, contraste, foco y anuncios de error.
- **Pruebas** con Testing Library del flujo de transferencia (incluido saldo insuficiente) y pruebas unitarias del BFF; **CI** en `.github/workflows/web.yml`.

**Proyectos que toca:** `/web` (nuevo) y `.github/workflows/web.yml`. Consume `/contract` como dependencia; no modifica `/api`, `/mobile` ni `/contract`.

**Historias de usuario que cubre (lado web):** HU1 (registro e inicio de sesión), HU2 (cuentas con saldo disponible), HU3 (alta de beneficiario con validación de CLABE), HU4 (transferencia con concepto y referencia), HU5 (historial con filtros por fecha y tipo, paginado) y HU6 (límite diario y confirmación por OTP).

## Capabilities

### New Capabilities
- `web-app`: Panel web con BFF en Next.js — sesión en servidor, Server Actions para mutaciones, proxy GET de lecturas, pantallas del flujo financiero, idempotencia del lado del cliente, accesibilidad y pruebas.

### Modified Capabilities
<!-- Ninguna: es el primer change que define comportamiento del cliente web. -->

## Impact

- **Código nuevo:** `/web` (Next.js App Router, TanStack Query, Zod vía paquete de contrato).
- **Dependencias:** `@morgandevchrisvaz/wallet-contract` (cliente tipado, validadores, `formatMXN`, unión de `code`); Redis solo en la propuesta de AWS.
- **API consumida:** todas las operaciones de `contract/openapi.yaml` excepto `healthCheck`.
- **Supuestos sobre otros changes:** `contract-v1` exporta los esquemas Zod de formularios, `createApiClient`, `formatMXN`, `ProblemCode` y `ProblemError`; `api-foundation` confía en `X-Forwarded-For` solo cuando viene del BFF; `api-ledger` implementa la semántica de idempotencia y OTP descrita en el contrato.
- **Despliegue:** la web deja de ser estática; en AWS requiere Amplify Hosting con SSR o Next en Fargate (lo documenta el change `delivery`).
- **CI:** nuevo workflow disparado por cambios en `web/**` y `contract/**`.
