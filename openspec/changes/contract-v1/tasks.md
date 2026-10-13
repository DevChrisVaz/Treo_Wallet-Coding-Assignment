## 1. Proyecto y herramientas

- [x] 1.1 [contract] Crear `contract/package.json` (nombre `@morgandevchrisvaz/wallet-contract`, `version` igual a `info.version`, `zod` como `peerDependency` de una sola versión mayor, `main`/`module`/`types`/`exports`, `files`, `sideEffects: false`), `tsconfig.json` estricto, tsup, Vitest, ESLint y Prettier (CTR-15)
- [x] 1.2 [contract] Agregar `redocly.yaml` con las reglas recomendadas y la excepción para `localhost`, y el script `lint:contract`; dejar el contrato sin errores ni avisos no justificados (CTR-01)
- [x] 1.3 [contract] Script `check:version` que falla si `package.json#version` difiere de `info.version`, con su prueba (CTR-02)

## 2. Tipos y cliente HTTP

- [x] 2.1 [contract] Generar los tipos con openapi-typescript en `src/generated/api.d.ts` mediante el script `generate`, y versionarlos (CTR-03)
- [x] 2.2 [contract] Exportar `PROBLEM_CODES` (arreglo de constantes) y el tipo `ProblemCode`, más alias de tipos de los esquemas principales (`Account`, `Movement`, `Transfer`, `Beneficiary`, `Problem`…) (CTR-03, CTR-07)
- [x] 2.3 [contract] Implementar `createApiClient({ baseUrl, getAccessToken, getRequestId })` sobre openapi-fetch, con pruebas de `fetch` simulado: respuesta tipada, header `Authorization: Bearer` y ningún almacenamiento del token (CTR-04)
- [x] 2.4 [contract] Middleware de `X-Request-Id` que reutiliza el ID provisto o genera uno por petición, con pruebas de ambos casos (CTR-05)
- [x] 2.5 [contract] Implementar `createIdempotencyKey(generator?)` (usa `crypto.randomUUID` o el generador inyectado y falla con mensaje claro si no hay ninguno) y comprobar que `createTransfer` exige la llave en tipos; pruebas: el reintento conserva la llave y sin generador lanza error (CTR-06)
- [x] 2.6 [contract] Implementar `ProblemError` y `NetworkError`: interpretar `application/problem+json` con sus extensiones, convertir 4xx/5xx sin problem+json en `INTERNAL_ERROR` sin exponer el cuerpo, y distinguir fallos sin respuesta; pruebas de `INSUFFICIENT_FUNDS` con `transferId`, red caída y 502 HTML (CTR-07)

## 3. Validadores de entrada

- [x] 3.1 [contract] Crear las tablas de vectores en `test/vectors/` (monto, CLABE, CURP sintética, RFC sintético, teléfono, concepto, referencia, OTP), cada una con casos válidos e inválidos y el `code` de error esperado (CTR-08, CTR-09, CTR-10, CTR-11, CTR-12)
- [ ] 3.2 [contract] Implementar `amountInput` (solo strings, sin floats), `toCents` y `centsToDecimalString`; pruebas: montos aceptados, redondeo `"100.005"` rechazado sin redondear, número JSON rechazado, formatos inválidos, tope de 12 dígitos y conversión exacta de `"1.15"`, `"0.10"` y `"0.20"` (CTR-08)
- [ ] 3.3 [contract] Implementar `clabeCheckDigit` y el esquema `clabe`; pruebas: `032180000118359719` válida, dígito alterado, caso A = 0 → 0, 17 dígitos, letras y valor numérico (CTR-09)
- [ ] 3.4 [contract] Implementar `curpCheckDigit`, `isValidCalendarDate` y el esquema `curp`; pruebas con CURPs sintéticas: válida, dígito alterado y fecha `990231` (CTR-10)
- [ ] 3.5 [contract] Implementar el esquema `rfc` de persona física con validación de fecha; pruebas: válido, fecha `010229` y RFC de 12 caracteres (CTR-11)
- [ ] 3.6 [contract] Implementar los esquemas `phone`, `concept`, `reference` y `otpCode`; pruebas con los vectores de cada uno (CTR-12)
- [ ] 3.7 [contract] Implementar los esquemas de formulario `registerForm`, `verifyEmailForm`, `loginForm`, `beneficiaryForm` y `transferForm` (destino como unión discriminada) con códigos de error por campo; pruebas: destino incoherente rechazado y errores simultáneos de monto y concepto (CTR-13)
- [ ] 3.8 [contract] Prueba de paridad: compilar los esquemas de componentes de `openapi.yaml` con Ajv (2020-12) y ejecutar las mismas tablas de vectores contra Ajv y contra Zod (CTR-13)

## 4. Formato de montos

- [ ] 4.1 [contract] Implementar `formatMXN` con operaciones de texto (signo, agrupación de miles, 2 decimales); pruebas: `"1250.50"`, `"-150.00"`, `"0.01"` y `"9999999999999999.99"` (CTR-14)
- [ ] 4.2 [contract] Prueba de oráculo en Node contra `Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })` con strings, y prueba estática de que `formatMXN` no usa `Number`, `parseFloat` ni `Intl` (CTR-14)

## 5. Build y distribución

- [ ] 5.1 [contract] Configurar el build ESM + CJS + declaraciones, el subpath `./openapi.yaml` y el script `prepare` que construye `dist/` (CTR-15, CTR-16)
- [ ] 5.2 [contract] Script `check:no-node-imports` sobre `dist/` y prueba de humo que importa el paquete construido con `import` y con `require` en Node 20 (CTR-15)
- [ ] 5.3 [contract] Script `verify:install` que crea un proyecto temporal, instala `file:<ruta>/contract` con `install-links=true` sin credenciales y comprueba que el paquete es una copia (no un enlace simbólico) con sus dependencias resueltas (CTR-16)

## 6. CI y documentación

- [ ] 6.1 [contract] Crear `.github/workflows/contract.yml` (se ejecuta ante cambios en `contract/**`, Node 20): `npm ci`, lint del contrato, `generate` + `git diff --exit-code`, typecheck, pruebas, build, `check:version`, `check:no-node-imports`, `verify:install` y `npm pack --dry-run` (CTR-17, CTR-01, CTR-03)
- [ ] 6.2 [contract] Escribir `contract/README.md`: propósito, exports, uso desde cada consumidor (`file:../contract` + `install-links=true`), ciclo de desarrollo local, política semver del contrato y procedimiento de publicación en GitHub Packages al separar los repositorios (CTR-02, CTR-16)
