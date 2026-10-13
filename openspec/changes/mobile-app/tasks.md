## 1. Andamiaje del proyecto

- [x] 1.1 [mobile] Crear el proyecto `/mobile` con Expo, TypeScript estricto y Expo Router; configurar ESLint y Prettier y los scripts `lint`, `typecheck` y `test` (MOB-17)
- [x] 1.2 [mobile] Instalar `@devchrisvaz/wallet-contract` con `file:../contract` y `@devchrisvaz/wallet-design-tokens` con `file:../design-tokens`, y `mobile/.npmrc` con `install-links=true`; comprobar en Expo Go que Metro resuelve `createApiClient`, `formatMXN` y el subpath `./native` (campo `exports` o respaldo `main`/`types`) (MOB-15, DSG-01)
- [x] 1.3 [mobile] Configurar jest-expo y Testing Library con mocks de `expo-secure-store`, NetInfo y `AppState` (MOB-02, MOB-10, MOB-16)
- [x] 1.4 [mobile] Leer y validar `EXPO_PUBLIC_API_URL` al arrancar y mostrar una pantalla de error de configuración si falta o es inválida, con su prueba (MOB-17)
- [x] 1.5 [mobile] Prohibir `@react-native-async-storage/async-storage` con la regla `no-restricted-imports` de ESLint y agregar una prueba que falle si algún módulo lo importa (MOB-02)
- [x] 1.6 [mobile] Cargar Work Sans con `@expo-google-fonts/work-sans` (400, 500, 600) manteniendo la pantalla de carga hasta `useFonts`, y exponer el tema de `@devchrisvaz/wallet-design-tokens/native` a la app (DSG-01, DSG-05)
- [x] 1.7 [mobile] Componentes del inventario de `design-system` en `components/ui` (Wordmark, Button, TextField, AmountField, OtpField, Select en hoja inferior, AccountCard, MovementRow, StatusBadge, InlineAlert, EmptyState, Skeleton, Receipt, DailyLimitMeter) con `StyleSheet` y solo tokens, con estados y `accessibilityState`; pruebas (DSG-03, DSG-06, DSG-09, DSG-10, DSG-11)

## 2. Sesión y cliente HTTP

- [x] 2.1 [mobile] Módulo de sesión: refresh token en `expo-secure-store` con `WHEN_UNLOCKED_THIS_DEVICE_ONLY` y access token solo en memoria; pruebas de que ningún token llega a otro almacenamiento (MOB-02)
- [ ] 2.2 [mobile] Cliente de la API sobre `createApiClient` con middleware de `Authorization: Bearer` y tiempo de espera de 15 s por intento con `AbortController` (MOB-03, MOB-10)
- [ ] 2.3 [mobile] Renovación de una sola vez ante `401 UNAUTHENTICATED` con promesa compartida, guardado del nuevo refresh antes de usar el nuevo access y limpieza ante `SESSION_REVOKED`; pruebas con tres peticiones simultáneas y con sesión revocada (MOB-03)
- [ ] 2.4 [mobile] Restaurar la sesión al arrancar a partir del refresh guardado y enviar al inicio de sesión si no existe o es revocado; pruebas de ambos caminos (MOB-02, MOB-03)
- [ ] 2.5 [mobile] Cierre de sesión que llama a `logout` y borra los tokens locales aunque la API no responda; prueba sin red (MOB-04)
- [ ] 2.6 [mobile] Mensajes por `code` con `problemMessage` del paquete de diseño, comprobación de exhaustividad contra `ProblemCode` del contrato y mensaje genérico con `requestId`; pruebas de `INSUFFICIENT_FUNDS`, `DAILY_LIMIT_EXCEEDED` con `remaining` e `INTERNAL_ERROR` (MOB-14, DSG-12)

## 3. Pantallas de consulta

- [ ] 3.1 [mobile] Pantalla de inicio de sesión con estados de envío, error genérico, bloqueo por `429` con cuenta regresiva de `Retry-After` y mensaje de correo sin verificar; pruebas de cada estado (MOB-01)
- [ ] 3.2 [mobile] Pantalla de saldo con TanStack Query: cuentas con nombre, últimos 4 dígitos de la CLABE y saldo con `formatMXN`, monto restante del límite diario, estados de carga, vacío y error y refresco al deslizar, con `AccountCard` y `DailyLimitMeter`; pruebas (MOB-05, MOB-15, DSG-09, DSG-11)
- [ ] 3.3 [mobile] Pantalla de últimos 20 movimientos de la cuenta elegida (`listAccountMovements` con `limit=20`) con `MovementRow` (etiqueta, signo y color por dirección del paquete de diseño) y saldo resultante, y estados de carga, vacío y error; pruebas (MOB-06, MOB-15, DSG-09, DSG-10)
- [ ] 3.4 [mobile] Prueba de formato de montos en `es-MX` a partir de strings (`"1234567.89"`, `"0.10"`, `"-150.00"`) usando `formatMXN` (MOB-15)

## 4. Flujo de transferencia

- [ ] 4.1 [mobile] Módulo `transferAttempt` en TypeScript puro con los estados del diseño, llave UUID generada con `expo-crypto` al pasar a revisión y payload congelado; pruebas de llave única por intento, llave nueva al editar y doble toque con una sola petición (MOB-09)
- [ ] 4.2 [mobile] Política de reintentos en `transferAttempt`: error de red, tiempo de espera y `5xx` con espera de 1 a 16 s (±20 %) y máximo 5 reintentos, `4xx` definitivos y `429` con reintento manual; pruebas con temporizadores falsos y payload idéntico en cada reintento (MOB-10)
- [ ] 4.3 [mobile] Reintento inmediato al recuperar la conexión según NetInfo, cancelando la espera pendiente; prueba con NetInfo simulado (MOB-10)
- [ ] 4.4 [mobile] Estado incierto tras agotar los reintentos con reintento manual usando la misma llave y el mismo payload; pruebas (MOB-11)
- [ ] 4.5 [mobile] Pantalla para elegir un beneficiario registrado (`listBeneficiaries`) con alias, nombre y últimos 4 dígitos de la CLABE, y estado vacío que remite a la web; pruebas (MOB-07)
- [ ] 4.6 [mobile] Formulario de transferencia con cuenta de origen, monto, concepto y referencia validados con los esquemas Zod del contrato; el monto viaja como string; pruebas de `100.005`, `1250`, `0.00` y referencia `12A45` (MOB-08)
- [ ] 4.7 [mobile] Pantalla de confirmación con resumen, aviso de OTP para montos mayores a 10,000.00 y botón deshabilitado durante el envío; pruebas (MOB-09)
- [ ] 4.8 [mobile] Pantallas de envío, estado incierto y rechazo conectadas a `transferAttempt`, con el mensaje de cada `code` y opción de corregir con llave nueva tras un rechazo; pruebas (MOB-10, MOB-11, MOB-14)
- [ ] 4.9 [mobile] Pantalla del OTP con correo enmascarado, tiempo restante, intentos restantes, reenvío (`resendTransferOtp`), aviso cuando `deliveryStatus` es `FAILED` y confirmación con la misma política de reintentos; pruebas de `OTP_INVALID`, `OTP_ATTEMPTS_EXHAUSTED`, `TRANSFER_EXPIRED`, `RESEND_LIMIT_REACHED` y pérdida de red al confirmar (MOB-12)
- [ ] 4.10 [mobile] Comprobante (`Receipt` con `StatusBadge`) construido con la respuesta de la API e invalidación de las consultas de cuentas y movimientos al completar; pruebas (MOB-13, DSG-10, DSG-11)
- [ ] 4.11 [mobile] Prueba del caso borde completo: la respuesta de `createTransfer` se pierde, la red vuelve y el reintento con la misma llave recibe `200` con `Idempotent-Replayed: true` y estado `COMPLETED`, sin una segunda transferencia (MOB-10, MOB-13)

## 5. Privacidad

- [ ] 5.1 [mobile] Pantalla de privacidad en la raíz (`surface.inverse` con el `Wordmark`) que cubre el contenido con `AppState` `inactive` o `background` y se retira con `active`; pruebas con `AppState` simulado (MOB-16, DSG-11)
- [ ] 5.2 [mobile] Activar `expo-screen-capture` mientras hay sesión para dejar en blanco la miniatura del selector de apps en Android y desactivarlo al cerrar sesión (MOB-16)

## 6. Documentación y CI

- [ ] 6.1 [mobile] README de `/mobile`: requisitos, instalación del paquete de contrato, `EXPO_PUBLIC_API_URL` con la IP de la red local (y `10.0.2.2` en el emulador de Android), ejecución en Expo Go o simulador, bandeja de Mailpit para los OTP, usuarios del seed, pruebas y "qué haría con más tiempo" (biometría y recuperar el intento tras matar la app) (MOB-17)
- [ ] 6.2 [mobile] Workflow `.github/workflows/mobile.yml` disparado por `mobile/**`, `contract/**`, `design-tokens/**` y el propio workflow: compilar el contrato y el paquete de diseño, `npm ci` en `/mobile`, lint, `tsc --noEmit` y pruebas (MOB-01–MOB-17)
- [ ] 6.3 [mobile] Verificación manual en Expo Go contra la API local con el guion del video: inicio de sesión, saldo, movimientos, transferencia mayor a 10,000.00 con OTP leído en Mailpit, intento con saldo insuficiente y modo avión a mitad del envío (MOB-01, MOB-05, MOB-06, MOB-10, MOB-12, MOB-14)
