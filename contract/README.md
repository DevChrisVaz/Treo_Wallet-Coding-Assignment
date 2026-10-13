# @devchrisvaz/wallet-contract

Contrato de la API de la billetera y todo lo que los demás proyectos derivan de él: tipos generados, cliente HTTP tipado, validadores de entrada y formato de montos.

`openapi.yaml` (OpenAPI 3.1) es la **fuente de verdad**: se escribió antes que el código y lo consumen `/api`, `/web` y `/mobile`. Especificación vigente: `openspec/specs/api-contract/spec.md` (requisitos CTR-01 a CTR-17); propuesta, diseño y tareas en `openspec/changes/archive/2026-10-13-contract-v1/`.

## Qué exporta

| Export                                                                                                                       | Para qué                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `paths`, `components`, `operations` y alias (`Account`, `Movement`, `Transfer`, `Problem`, `ProblemCode`, `FieldErrorCode`…) | Tipos generados desde `openapi.yaml` con openapi-typescript                                                                                                                                           |
| `PROBLEM_CODES`                                                                                                              | Todos los valores de `ProblemCode`, para `switch` exhaustivos                                                                                                                                         |
| `createApiClient({ baseUrl, getAccessToken?, getRequestId?, fetch? })`                                                       | Cliente tipado por rutas (openapi-fetch). Envía `X-Request-Id` y `Authorization: Bearer`; **nunca guarda el token**                                                                                   |
| `ProblemError`, `NetworkError`, `toProblemError`                                                                             | Las respuestas de error llegan como `ProblemError` (con `code`, `requestId` y las extensiones); los fallos sin respuesta, como `NetworkError`, la única condición que se reintenta con la misma llave |
| `createIdempotencyKey(generator?)`                                                                                           | Llave UUID, una por intento de transferencia                                                                                                                                                          |
| `amountInput`, `toCents`, `centsToDecimalString`                                                                             | Montos como string, convertidos a centavos con `BigInt`; nunca floats ni redondeo                                                                                                                     |
| `clabe`, `curp`, `rfc`, `phone`, `concept`, `reference`, `otpCode`                                                           | Validadores de campo (Zod) con dígito verificador (CLABE, CURP) y fecha (CURP, RFC)                                                                                                                   |
| `registerForm`, `verifyEmailForm`, `loginForm`, `beneficiaryForm`, `transferForm`, `transferDestination`                     | Esquemas de formularios alineados con los requests del contrato                                                                                                                                       |
| `toFieldErrors`                                                                                                              | Convierte un error de Zod en `FieldError[]` del contrato (JSON Pointer + `FieldErrorCode`)                                                                                                            |
| `formatMXN(amount)`                                                                                                          | `"1250.50"` → `$1,250.50`, solo con operaciones de texto                                                                                                                                              |
| `./openapi.yaml` (subpath)                                                                                                   | El contrato, para Swagger UI y las pruebas de contrato de la API                                                                                                                                      |

## Uso en cada consumidor

Los proyectos son independientes (sin workspaces). Mientras vivan en un solo repositorio, cada consumidor instala el paquete **como artefacto**, no como enlace simbólico:

```jsonc
// package.json del consumidor
"dependencies": {
  "@devchrisvaz/wallet-contract": "file:../contract",
  "zod": "^4.0.0" // peerDependency: una sola versión mayor de Zod en todo el proyecto
}
```

```ini
# .npmrc del consumidor
install-links=true
```

Con `install-links=true`, npm copia el paquete e instala sus dependencias como si viniera de un registro. Sin esa opción crea un enlace simbólico y **no instala las dependencias del paquete**, porque la carpeta está fuera del proyecto. No hace falta token ni registro: `npm run verify:install` lo comprueba.

| Consumidor | Qué usa                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/api`     | Solo `openapi.yaml` (Swagger UI y pruebas de contrato con Ajv) y los tipos. Valida la entrada con su propio Zod, con transformaciones de dominio |
| `/web`     | Cliente (en las Server Actions y el proxy del BFF), validadores (mismo esquema en el formulario y en la acción) y `formatMXN`                    |
| `/mobile`  | Cliente, validadores del formulario de transferencia y `formatMXN`                                                                               |

**Hermes no tiene `crypto.randomUUID`:** la app móvil pasa un generador a `createIdempotencyKey(randomUUID)` (de `expo-crypto`). Los request IDs no lo necesitan: el cliente usa el ID por petición que genera openapi-fetch.

```ts
import {
  createApiClient,
  createIdempotencyKey,
  ProblemError,
  NetworkError,
} from '@devchrisvaz/wallet-contract';

const api = createApiClient({
  baseUrl: 'http://localhost:4000',
  getAccessToken: () => session.accessToken,
});
const key = createIdempotencyKey(); // una vez por intento; los reintentos reutilizan la misma

try {
  const { data } = await api.POST('/transfers', {
    params: { header: { 'Idempotency-Key': key } },
    body: {
      fromAccountId,
      destination: { type: 'BENEFICIARY', beneficiaryId },
      amount: '1500.00',
      concept: 'Renta',
      reference: '1',
    },
  });
} catch (error) {
  if (error instanceof NetworkError) {
    /* reintentar con la MISMA llave */
  }
  if (error instanceof ProblemError && error.code === 'INSUFFICIENT_FUNDS') {
    /* error.transferId */
  }
}
```

## Desarrollo

Herramientas en **Node 24**; el paquete construido funciona desde **Node 20** (la prueba de humo del CI lo comprueba en 20, 22 y 24).

```bash
npm ci
npm test               # pruebas unitarias, de vectores y de paridad con el contrato
npm run build          # dist/: ESM, CJS y declaraciones
```

| Script                              | Qué verifica                                                                                 |
| ----------------------------------- | -------------------------------------------------------------------------------------------- |
| `lint:contract`                     | Lint de `openapi.yaml` con Redocly (excepciones justificadas en `.redocly.lint-ignore.yaml`) |
| `generate`                          | Regenera `src/generated/api.d.ts`; el CI falla si el resultado difiere del versionado        |
| `typecheck`, `lint`, `format:check` | TypeScript estricto, ESLint y Prettier                                                       |
| `check:version`                     | `version` del paquete igual a `info.version` del contrato                                    |
| `check:exports`                     | Cada ruta de `main`, `module`, `types` y `exports` existe después del build                  |
| `check:no-node-imports`             | El build no importa módulos internos de Node (debe funcionar en Hermes)                      |
| `smoke`                             | El paquete construido funciona con `import` y con `require`                                  |
| `verify:install`                    | Un consumidor nuevo lo instala como copia, sin credenciales y con sus dependencias           |

**Ciclo al cambiar el contrato:** editar `openapi.yaml` → `npm run generate` → ajustar validadores y vectores → `npm test` → `npm run build` → en cada consumidor, `npm install` para recibir la nueva copia (con `install-links`, los cambios no llegan solos).

**Vectores de prueba:** `test/vectors/` es la especificación ejecutable de los validadores. Los dígitos verificadores se calcularon a mano; las CURP y RFC son sintéticas. La prueba de paridad pasa cada vector por el esquema del yaml (Ajv) y por el validador del paquete.

**Aviso conocido:** `npm audit` reporta una vulnerabilidad baja de esbuild (servidor de desarrollo en Windows), que llega por tsup y Vite. Solo afecta a herramientas de desarrollo que este paquete no usa en ese modo, y no está en las dependencias de runtime (`npm audit --omit=dev` está limpio).

## Versionado del contrato

`version` del paquete = `info.version` del contrato (semver):

- **Mayor:** eliminar o renombrar una ruta, un campo requerido o un valor de enum (por ejemplo de `ProblemCode`), o endurecer una validación.
- **Menor:** agregar rutas, campos opcionales o valores que los clientes puedan ignorar.
- **Parche:** documentación o correcciones sin cambio de comportamiento.

Un `code` de error que el paquete no conoce se reporta como `INTERNAL_ERROR` (conservando el original en `rawCode`), así que una API más nueva no rompe los `switch` de clientes más viejos.

## Publicación al separar los repositorios

Hoy el paquete **no se publica**: `"private": true` y los consumidores usan `file:../contract`. Cuando cada proyecto tenga su propio repositorio:

1. En este paquete: quitar `"private": true`, agregar `"publishConfig": { "registry": "https://npm.pkg.github.com" }` y un workflow que publique al crear un tag `v*` (con `permissions: packages: write`). GitHub Packages exige que el scope sea el dueño del repositorio (`@devchrisvaz`).
2. En cada consumidor, cambiar **una línea** del `package.json` y el `.npmrc`:
   ```jsonc
   "@devchrisvaz/wallet-contract": "^1.0.0"   // antes: "file:../contract"
   ```
   ```ini
   @devchrisvaz:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
   ```
   y quitar `install-links=true`.
3. En el CI de cada consumidor: `permissions: packages: read` y `NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`. GitHub Packages pide token incluso para paquetes públicos, y cada repositorio consumidor necesita acceso de lectura desde la configuración del paquete.
4. Para revertir: fijar la versión anterior en el `package.json` del consumidor.
