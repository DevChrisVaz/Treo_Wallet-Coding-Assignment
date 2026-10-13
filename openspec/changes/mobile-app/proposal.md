## Why

El enunciado pide una app móvil en React Native de alcance reducido que consuma la misma API que la web. El reto en móvil no es la cantidad de pantallas, sino que el dinero cuadre aunque la red falle a mitad de una transferencia, que los tokens queden en almacenamiento seguro y que el contenido sensible no se vea al pasar a segundo plano.

## What Changes

- Nuevo proyecto independiente `/mobile` (Expo + TypeScript) con su propio lockfile y su propio CI. Consume el paquete `@morgandevchrisvaz/wallet-contract` mediante `file:../contract` con `install-links=true`, sin workspaces.
- Pantallas: inicio de sesión, saldo de las cuentas, últimos 20 movimientos de la cuenta elegida y transferencia a un beneficiario ya registrado (captura, confirmación, OTP cuando el monto supera 10,000.00 MXN y resultado con el estado real).
- Sesión: el refresh token se guarda en el almacenamiento seguro del sistema operativo y el access token solo en memoria; el refresh se hace una sola vez aunque varias peticiones lo necesiten al mismo tiempo; cierre de sesión.
- Red inestable: reintentos con backoff exponencial y con la misma `Idempotency-Key`, reintento al recuperar la conexión y opción manual de reintentar, mostrando siempre el estado real de la operación.
- Privacidad: pantalla que oculta el contenido sensible cuando la app pasa a segundo plano.
- Mensajes de error decididos por el `code` del problema (RFC 9457) y montos formateados con `formatMXN` del paquete de contrato, sin floats.
- README del proyecto con instrucciones para Expo Go o simulador apuntando a la API local, y workflow de CI con lint, typecheck y pruebas.
- Fuera de alcance (va a "qué haría con más tiempo"): registro y verificación de correo en móvil, desbloqueo biométrico y recuperar un intento de transferencia cuando el sistema operativo mata la app.

## Capabilities

### New Capabilities
- `mobile-app`: comportamiento de la app móvil — pantallas y estados, manejo de sesión y almacenamiento seguro de tokens, transferencias resistentes a pérdida de red con idempotencia, confirmación por OTP, privacidad en segundo plano y presentación de montos y errores.

### Modified Capabilities
<!-- Ninguna: el comportamiento de la API (identity, accounts, movement-history, beneficiaries, transfers) se define en api-foundation y api-ledger; este change solo lo consume. -->

## Impact

- **Proyectos:** `/mobile` (nuevo). Consume `/contract` como artefacto (`file:../contract`); no modifica `/api`, `/web` ni `/contract`.
- **Historias de usuario cubiertas:** HU1 (solo inicio de sesión; el registro se hace en la web), HU2 (saldo de las cuentas), HU4 (transferencia a un beneficiario ya registrado), HU5 (últimos 20 movimientos, sin filtros) y HU6 (confirmación por OTP de montos mayores a 10,000.00 MXN y mensaje de límite diario). HU3 (alta de beneficiarios) queda fuera del móvil por el alcance reducido del enunciado.
- **Endpoints del contrato usados** (`contract/openapi.yaml`): `login`, `refreshSession`, `logout`, `getCurrentUser`, `listAccounts`, `listAccountMovements`, `listBeneficiaries`, `createTransfer`, `getTransfer`, `confirmTransfer`, `resendTransferOtp`.
- **Dependencias nuevas:** Expo (SDK vigente), `expo-secure-store`, `@react-native-community/netinfo`, TanStack Query y jest-expo para pruebas.
- **CI:** nuevo `.github/workflows/mobile.yml`, disparado por cambios en `mobile/**` y `contract/**`.
- **Entorno local:** la API debe estar accesible desde el dispositivo o simulador mediante la IP de la LAN; Mailpit (levantado por `/api`) recibe los OTP.
