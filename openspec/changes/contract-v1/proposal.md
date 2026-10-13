## Why

La API, la web y la app móvil son proyectos independientes (sin monorepo ni workspaces), pero el enunciado pide que ambos clientes compartan tipos generados desde el contrato OpenAPI y que la validación de formularios coincida con la del backend. Sin un artefacto común, los patrones de dinero, CLABE, CURP y RFC se reescribirían tres veces y terminarían divergiendo, que es exactamente donde nacen los errores de saldo y de redondeo. Este change crea ese artefacto común antes que cualquier otro proyecto, porque es el contrato que todos los demás consumen.

## What Changes

- Nuevo proyecto `/contract`: paquete `@devchrisvaz/wallet-contract`, con `contract/openapi.yaml` (OpenAPI 3.1, ya escrito en la fase de especificación) como fuente de verdad.
- Tipos generados desde el contrato y un cliente HTTP tipado por rutas, con middlewares neutrales: request ID, header `Idempotency-Key`, inyección del Bearer por un hook y conversión de `application/problem+json` en un error tipado por `code`.
- Validadores de entrada compartidos para los clientes: monto (sin floats, sin redondeo, con conversión a centavos), CLABE y CURP con dígito verificador, RFC de persona física, teléfono, concepto, referencia, OTP y los esquemas de los formularios.
- `formatMXN`: formato de montos en `es-MX` a partir del string decimal, exacto y sin floats, también en Hermes.
- Distribución sin dependencias de código entre proyectos: los consumidores lo instalan como artefacto (`file:../contract` con `install-links=true`) mientras todo viva en un solo repositorio; la publicación en GitHub Packages queda documentada para cuando se separen los repositorios.
- CI propio (`.github/workflows/contract.yml`): lint del contrato, tipos al día, typecheck, pruebas con vectores, build y empaquetado.

**Proyectos que toca:** `/contract` (nuevo). `/api`, `/web` y `/mobile` lo consumen en sus propios changes.

**Historias de usuario que habilita:** HU1 (registro e inicio de sesión: esquemas y validadores), HU3 (CLABE con dígito verificador), HU4 (monto, concepto, referencia y destino de la transferencia), HU5 (tipos de movimientos y paginación), HU6 (OTP), y el formato de montos de HU2.

## Capabilities

### New Capabilities
- `api-contract`: contrato OpenAPI como fuente de verdad, tipos generados, cliente tipado, validadores compartidos, formato de montos y la forma en que los demás proyectos consumen el paquete.

### Modified Capabilities
<!-- Ninguna: es la primera capability del sistema. -->

## Impact

- **Código nuevo:** `/contract` (fuentes, pruebas, build) y `.github/workflows/contract.yml`.
- **Dependencias:** generador de tipos OpenAPI, cliente `fetch` tipado, Zod como `peerDependency`, herramienta de lint del contrato y empaquetador ESM/CJS.
- **Consumidores:** `/api` usa solo el yaml y los tipos (Swagger UI y pruebas de contrato); `/web` y `/mobile` usan además el cliente, los validadores y `formatMXN`.
- **Cambios futuros del contrato:** siguen semver en `info.version`; uno incompatible implica versión mayor y la actualización explícita de cada consumidor.
