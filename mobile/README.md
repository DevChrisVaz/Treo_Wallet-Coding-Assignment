# TreoWallet móvil

App móvil de TreoWallet (Expo SDK 57 + React Native + Expo Router, TypeScript estricto) con el alcance reducido del enunciado: iniciar sesión, ver el saldo de las cuentas y los últimos 20 movimientos, y transferir a un beneficiario ya registrado, con OTP por correo para montos mayores a $10,000.00. Habla directamente con la API usando `Authorization: Bearer`.

- Especificación: `openspec/changes/mobile-app/` (requisitos MOB-01 a MOB-17; decisiones y notas de implementación en `design.md`).
- Sistema de diseño: `@devchrisvaz/wallet-design-tokens` (tokens, Work Sans, textos de error, estados y movimientos).
- Contrato: `@devchrisvaz/wallet-contract` (cliente tipado, validadores Zod, `formatMXN`).

## Requisitos

- Node 24 para las herramientas (el CI usa Node 24).
- La API local corriendo (ver `api/README.md`): `docker compose up -d`, migraciones, seed y `npm run dev`. La API escucha en `0.0.0.0:4000` para que el teléfono la alcance por la red local, y levanta Mailpit.
- Para probar en un teléfono: la app **Expo Go** compatible con el SDK 57, en la **misma red Wi-Fi** que la computadora. También sirve un emulador de Android o el simulador de iOS (macOS).

## Instalación

Los paquetes del contrato y del sistema de diseño se instalan **como copia** desde las carpetas vecinas (`file:../contract`, `file:../design-tokens`), sin workspaces ni registro: `mobile/.npmrc` fija `install-links=true`. Hay que compilarlos antes:

```bash
cd contract && npm ci && npm run build && cd ..
cd design-tokens && npm ci && npm run build && cd ..
cd mobile && npm ci
```

Si cambias el contrato o los tokens, vuelve a compilarlos y ejecuta `npm install` en `/mobile` para recibir la copia nueva.

## Configurar la URL de la API

La app lee la URL base de `EXPO_PUBLIC_API_URL` (Expo la incorpora al bundle), sin cambios de código. Copia `.env.example` a `.env` y ajústala:

| Dónde corre la app     | `EXPO_PUBLIC_API_URL`                                                      |
| ---------------------- | -------------------------------------------------------------------------- |
| Expo Go en un teléfono | `http://<IP de tu red local>:4000`, por ejemplo `http://192.168.1.50:4000` |
| Emulador de Android    | `http://10.0.2.2:4000`                                                     |
| Simulador de iOS       | `http://localhost:4000`                                                    |

Para conocer la IP de tu red local: `ipconfig getifaddr en0` (macOS), `hostname -I` (Linux) o `ipconfig` (Windows). Si la variable falta o no es una URL `http(s)`, la app muestra una pantalla de configuración que lo explica en lugar de fallar en silencio. Después de cambiar `.env`, reinicia Expo (`npx expo start --clear`).

> En local la app usa HTTP sin TLS hacia la IP de tu equipo; es solo para desarrollo. En producción la URL es HTTPS.

## Ejecutar

```bash
npx expo start          # escanea el QR con Expo Go (Android) o con la cámara (iOS)
npm run android         # emulador de Android
npm run ios             # simulador de iOS (macOS)
```

**Usuarios de prueba:** los del seed de la API (Ana y Luis, verificados, con sus dos cuentas y beneficiarios); sus correos y contraseñas están en `api/README.md`. El registro, la verificación del correo y el alta de beneficiarios se hacen en la web.

**Códigos OTP (transferencias mayores a $10,000.00):** llegan por correo a **Mailpit**. Abre la bandeja en la computadora, `http://localhost:8025`, y copia el código de 6 dígitos (vence en 5 minutos; puedes reenviarlo desde la app).

## Scripts

| Script                               | Qué hace                                                                                                             |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `npm start`                          | Servidor de desarrollo de Expo                                                                                       |
| `npm test`                           | Pruebas con jest-expo y Testing Library (sin API real: `fetch`, `expo-secure-store`, NetInfo y `AppState` simulados) |
| `npm run typecheck`                  | `tsc --noEmit`                                                                                                       |
| `npm run lint`                       | ESLint (`eslint-config-expo`), incluida la regla que prohíbe AsyncStorage                                            |
| `npm run format:check`               | Prettier                                                                                                             |
| `npx expo export --platform android` | Ejecuta Metro y compila el bundle a Hermes sin dispositivo (así se verificó que Metro resuelve los paquetes locales) |

## Cómo está hecha

- `src/app/`: rutas de Expo Router (delgadas). El grupo `(app)` solo existe con sesión (`Stack.Protected`); sin sesión, solo `login`.
- `src/session/`: el **refresh token** vive en `expo-secure-store` (Keychain/Keystore, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`) y el **access token** solo en memoria. Nunca AsyncStorage: ESLint lo prohíbe y una prueba lo verifica. Al arrancar se restaura la sesión con el refresh guardado.
- `src/api/client.ts`: `createApiClient` del contrato con Bearer desde memoria, plazo de 15 s por intento y **renovación de una sola vez**: tres peticiones vencidas al mismo tiempo hacen una sola llamada a `/auth/refresh`.
- `src/features/transfer/transfer-attempt.ts`: máquina de estados en TypeScript puro. Una `Idempotency-Key` (UUID de `expo-crypto`) por intento y payload congelado; reintentos ante falta de red, tiempo agotado o `5xx` con espera de 1 a 16 s (±20 %) y máximo 5, con la misma llave y los mismos bytes; reintento inmediato cuando NetInfo avisa que volvió la red; estado **incierto** con reintento manual si se agotan. La confirmación del OTP sigue la misma política.
- Mensajes de error por `code` (RFC 9457) con `problemMessage` del paquete de diseño; montos siempre desde strings con `formatMXN`, sin floats.
- Privacidad: pantalla de privacidad en la raíz al pasar a segundo plano y `expo-screen-capture` mientras hay sesión.

## Verificación manual en Expo Go (pendiente, requiere un teléfono)

Guion del video, contra la API local (tarea 6.3). Antes: API, PostgreSQL y Mailpit arriba, `.env` con la IP de la red local, `npx expo start` y la app abierta en Expo Go.

1. **Inicio de sesión (MOB-01):** entra con un usuario del seed. Prueba también una contraseña incorrecta: debe decir "El correo o la contraseña no coinciden." y borrar la contraseña.
2. **Saldo (MOB-05):** verifica las cuentas con nombre, CLABE `•••• 1234`, saldo en `$25,000.00` y "Te quedan $X hoy". Desliza hacia abajo para actualizar.
3. **Movimientos (MOB-06):** toca una cuenta: los últimos 20, las salidas con `−$` en tinta y las entradas con `+$` en verde.
4. **Transferencia con OTP (MOB-12):** Transferir → elige un beneficiario → monto mayor a 10,000.00 (por ejemplo `15000`) → la confirmación avisa del código → Enviar → abre Mailpit en `http://localhost:8025`, copia el código → Confirmar → comprobante "Completada" con folio. Vuelve al saldo: debe estar actualizado.
5. **Saldo insuficiente (MOB-14):** intenta un monto mayor a tu saldo (dentro del límite diario): "No tienes saldo suficiente para esta transferencia." → Corregir.
6. **Modo avión a mitad del envío (MOB-10):** prepara una transferencia de hasta $10,000.00, toca Enviar y activa el modo avión de inmediato. La app muestra "Perdimos la conexión. Reintentaremos la misma operación (N de 5)." Desactiva el modo avión: el reintento sale en ese momento con la misma llave y la app muestra el comprobante (si la API ya la había completado, con el aviso de que ya se había registrado). Revisa en los movimientos que haya **una sola** transferencia.
7. **Privacidad (MOB-16):** con el saldo en pantalla, abre el selector de apps: debe verse la pantalla verde con "TreoWallet" (en Android, la miniatura en blanco).

## Qué haría con más tiempo

- **Desbloqueo biométrico** (Face ID / huella) para abrir la app con la sesión guardada, con `expo-local-authentication` y `requireAuthentication` de `expo-secure-store` (requiere un cliente de desarrollo propio: no funciona en Expo Go).
- **Recuperar un intento de transferencia si el sistema operativo mata la app** a mitad del envío: hoy el intento vive en memoria; persistiría la llave y el payload congelado en el almacenamiento seguro y, al volver, consultaría la transferencia o reintentaría con la misma llave. La transferencia ya es única gracias a la llave y aparece en los movimientos.
- Registro, verificación de correo, alta de beneficiarios y traspasos entre cuentas propias en el móvil (hoy en la web), historial con filtros y paginación, y pruebas de extremo a extremo en dispositivo (Maestro o Detox).

## Notas

- La salida CommonJS de `@devchrisvaz/wallet-contract` falla al llamar a `createApiClient` (interoperabilidad con openapi-fetch). Metro usa la salida ESM y no se ve afectado; en Jest, `jest.config.js` mapea el paquete a su salida ESM. Detalle en `design.md` (N1).
- `npm audit` reporta avisos (moderados y altos) en herramientas que llegan como dependencias de `expo` y `react-native` (Expo CLI, Metro, Jest y sus utilidades), que corren en la máquina de desarrollo. `npm audit fix --force` cambiaría versiones fijadas por el SDK, así que se revisan al actualizar el SDK de Expo.
