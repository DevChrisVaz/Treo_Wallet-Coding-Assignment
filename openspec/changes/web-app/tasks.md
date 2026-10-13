## 1. Proyecto y configuración

- [x] 1.1 [web] Crear `/web` con Next.js (App Router), TypeScript estricto y ESLint, con lockfile propio, `.npmrc` con `install-links=true` y las dependencias `"@devchrisvaz/wallet-contract": "file:../contract"` y `"@devchrisvaz/wallet-design-tokens": "file:../design-tokens"` (WEB-07, WEB-21, DSG-01)
- [x] 1.2 [web] Módulo de entorno del servidor validado con Zod al arrancar (`API_BASE_URL`, `ALLOWED_ORIGINS`, `SESSION_COOKIE_SECURE`, `SESSION_IDLE_MINUTES`) y `serverActions.allowedOrigins` tomado de `ALLOWED_ORIGINS`, con prueba de configuración (WEB-06, WEB-09)
- [x] 1.3 [web] Tailwind v4 con `@devchrisvaz/wallet-design-tokens/tailwind.css` (sin la paleta por defecto), Work Sans con `next/font/google` y layout base con el `Wordmark`, foco visible y enlace "Saltar al contenido" (WEB-23, DSG-01, DSG-02, DSG-05, DSG-06)
- [x] 1.4 [web] Configurar Vitest, Testing Library, jsdom y `vitest-axe`, y la regla de ESLint que prohíbe `parseFloat` y `Number(` en el código de montos (WEB-21, WEB-23)
- [x] 1.5 [web] Componentes del inventario de `design-system` en `components/ui` (Button, TextField, AmountField, OtpField, Select, AccountCard, MovementRow, StatusBadge, InlineAlert, EmptyState, Skeleton, Receipt, DailyLimitMeter) usando solo tokens, con sus variantes y estados y pruebas con `vitest-axe` (WEB-20, WEB-23, DSG-03, DSG-06, DSG-09, DSG-10, DSG-11)

## 2. Sesión en el servidor

- [x] 2.1 [web] Puerto `SessionStore` e implementación en memoria sobre `globalThis` con expiración por 15 minutos de inactividad y `touch`; pruebas con reloj falso (WEB-03)
- [x] 2.2 [web] Emisión y borrado de la cookie de sesión con atributos según el entorno (`__Host-sid` con `Secure` en HTTPS, `sid` en localhost); pruebas de atributos (WEB-02)
- [x] 2.3 [web] Contexto de petición: `X-Request-Id` reutilizado o generado y `X-Forwarded-For` con la IP del cliente; pruebas (WEB-10)
- [x] 2.4 [web] Cliente de API `server-only` con el cliente tipado del contrato: adjunta el Bearer, renueva el access token de una sola vez por sesión y cierra la sesión ante `SESSION_REVOKED`; prueba de tres peticiones concurrentes con una sola renovación (WEB-01, WEB-04)
- [x] 2.5 [web] `requireSession` y envoltorio común de acciones (`ActionResult`, `VALIDATION_FAILED` sin llamar a la API, `INTERNAL_ERROR` saneado con `requestId`); pruebas (WEB-07, WEB-08)

## 3. Proxy de lecturas

- [x] 3.1 [web] Route handler `GET /bff/api/[...path]` con lista blanca de rutas, solo GET, host fijo de `API_BASE_URL` y paso de parámetros de consulta; pruebas de ruta permitida, ruta fuera de lista y método distinto de GET (WEB-09)
- [x] 3.2 [web] `GET /bff/api/session` que responde con el usuario guardado en la sesión o `401`, sin exponer tokens; pruebas (WEB-01, WEB-22)

## 4. Autenticación

- [x] 4.1 [web] Acciones `login` y `logout` (crear sesión y cookie; revocar en la API y borrar localmente aunque la API falle); pruebas (WEB-01, WEB-05, WEB-12)
- [x] 4.2 [web] Acciones `register`, `verifyEmail` y `resendVerification`; `verifyEmail` crea la sesión con los tokens recibidos; pruebas (WEB-11)
- [x] 4.3 [web] Pantalla de inicio de sesión con mensaje genérico ante `INVALID_CREDENTIALS`, paso a verificación ante `EMAIL_NOT_VERIFIED` y espera según `Retry-After`; pruebas (WEB-12)
- [x] 4.4 [web] Pantalla de registro con los validadores del contrato (incluido el dígito verificador de la CURP) y mensaje genérico tras enviar; pruebas (WEB-11)
- [x] 4.5 [web] Pantalla de verificación de correo con captura del código, intentos restantes y reenvío; pruebas (WEB-11)
- [x] 4.6 [web] Layout protegido del grupo `(app)` con redirección a `/login?next=…`, saneamiento de `next` (solo rutas relativas) y botón "Cerrar sesión"; pruebas (WEB-05, WEB-22)

## 5. Base del cliente

- [x] 5.1 [web] `unwrap`, `ProblemError` y mensajes con `problemMessage` del paquete de diseño, con comprobación de exhaustividad contra `ProblemCode` del contrato y uso de extensiones (`attemptsRemaining`, `remaining`, `requestId`); pruebas de mensajes (WEB-08, WEB-19, DSG-12)
- [x] 5.2 [web] Proveedor de TanStack Query, claves de consulta, manejo de `401` en lecturas y componentes compartidos de carga, vacío y error con "Reintentar" (WEB-20, WEB-22)

## 6. Cuentas e historial

- [ ] 6.1 [web] Pantalla de resumen: cuentas con nombre, CLABE y saldo con `formatMXN`, y "Te quedan $X hoy" desde `dailyLimit.remaining`; estados de carga, vacío y error, con `AccountCard` y `DailyLimitMeter`; pruebas (WEB-13, WEB-20, WEB-21, DSG-09, DSG-11)
- [ ] 6.2 [web] Pantalla de historial: selector de cuenta, filtros de fecha y tipo, consulta infinita con "Cargar más", reinicio al cambiar filtros o ante `INVALID_CURSOR`; filas con `MovementRow` (etiqueta, signo y color por dirección); estados; pruebas (WEB-14, WEB-20, DSG-09, DSG-10)

## 7. Beneficiarios

- [ ] 7.1 [web] Acción `createBeneficiary` con validación del contrato y sesión obligatoria; pruebas (WEB-07, WEB-15)
- [ ] 7.2 [web] Pantallas de lista y alta con validación de formato y dígito verificador de la CLABE, mensajes para `CLABE_INVALID`, `CLABE_NOT_IN_PLATFORM`, `BENEFICIARY_IS_OWN_ACCOUNT` y `BENEFICIARY_CONFLICT`, e invalidación de la lista; estados; pruebas (WEB-15, WEB-20)

## 8. Transferencias

- [ ] 8.1 [web] Acciones `createTransfer(input, idempotencyKey)`, `confirmTransfer` y `resendTransferOtp`, reenviando la llave sin generarla ni reintentar; pruebas de una sola llamada con la llave recibida (WEB-10, WEB-17)
- [ ] 8.2 [web] Hook `useIdempotencyKey` y máquina de estados del flujo (llave al pasar a confirmación, nueva al editar o tras respuesta definitiva, misma al reintentar); pruebas (WEB-17)
- [ ] 8.3 [web] Formulario de transferencia: origen, destino propio sin la cuenta origen o beneficiario, monto como texto validado con `AmountInput` (rechazo de más de 2 decimales y limpieza de separadores), concepto y referencia; pruebas de redondeo y de propia cuenta (WEB-16, WEB-21)
- [ ] 8.4 [web] Pantalla de confirmación: envío con botón deshabilitado, reintento con la misma llave ante error de red o `5xx`, manejo de `200` con `Idempotent-Replayed` y de rechazos (`INSUFFICIENT_FUNDS` con saldo disponible, `DAILY_LIMIT_EXCEEDED`, `SAME_ACCOUNT_TRANSFER`); pruebas de doble clic (WEB-16, WEB-17, WEB-19)
- [ ] 8.5 [web] Pantalla de OTP: código de 6 dígitos, intentos restantes, reenvío, `deliveryStatus` `FAILED`, `TRANSFER_EXPIRED`, `OTP_ATTEMPTS_EXHAUSTED` y revalidación fallida, con botón deshabilitado al confirmar; pruebas (WEB-18)
- [ ] 8.6 [web] Comprobante (`Receipt` con `StatusBadge`) con estado, monto, origen, destino, concepto, referencia, fecha e id, e invalidación de cuentas e historial; pruebas (WEB-16, DSG-10, DSG-11)
- [ ] 8.7 [web] Prueba del flujo completo con Testing Library (formulario → confirmación → OTP → comprobante) y del caso de saldo insuficiente, con el módulo de acciones simulado (WEB-16, WEB-17, WEB-18)

## 9. Accesibilidad

- [ ] 9.1 [web] Anuncio de errores con `aria-live` y foco al mensaje de error en formularios y operaciones; pruebas con `vitest-axe` en login, registro, alta de beneficiario y transferencia (WEB-23)
- [ ] 9.2 [web] Verificación manual del flujo de transferencia solo con teclado y del contraste con Lighthouse, documentada en el README (WEB-23)

## 10. CI y documentación

- [ ] 10.1 [web] Workflow `.github/workflows/web.yml` disparado por `web/**`, `contract/**`, `design-tokens/**` y el propio workflow: compilar `/contract` y `/design-tokens`, `npm ci`, lint, typecheck, pruebas y `next build` (WEB-01, WEB-23)
- [ ] 10.2 [web] Verificación manual documentada de que una mutación con un `Origin` ajeno es rechazada (WEB-06)
- [ ] 10.3 [web] README de `/web`: requisitos, variables de entorno, cómo correr en local contra la API y Mailpit, cómo correr las pruebas, nota sobre `install-links` y verificaciones manuales (WEB-02, WEB-06, WEB-23)
