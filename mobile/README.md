# TreoWallet móvil

App móvil de TreoWallet (Expo SDK 57 + React Native + Expo Router, TypeScript estricto) con el alcance reducido del enunciado: iniciar sesión, ver el saldo de las cuentas y los últimos 20 movimientos, y transferir a un beneficiario ya registrado, con OTP por correo para montos mayores a $10,000.00. Como bonus, se abre con la huella (desbloqueo biométrico). Habla directamente con la API usando `Authorization: Bearer`.

- Especificación: `openspec/changes/mobile-app/` (requisitos MOB-01 a MOB-17; decisiones y notas de implementación en `design.md`), `openspec/changes/biometric-unlock/` (desbloqueo biométrico, MOB-24 a MOB-27) y `openspec/changes/redesign/` (rediseño: pestañas, Inicio, Movimientos, flujo por pasos e inicio de sesión de marca, MOB-18 a MOB-22).
- Sistema de diseño: `@devchrisvaz/wallet-design-tokens` (tokens, Work Sans, iconos por concepto, textos de error, estados y movimientos).
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

| Script                               | Qué hace                                                                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm start`                          | Servidor de desarrollo de Expo                                                                                                                    |
| `npm test`                           | Pruebas con jest-expo y Testing Library (sin API real: `fetch`, `expo-secure-store`, NetInfo, `expo-local-authentication` y `AppState` simulados) |
| `npm run typecheck`                  | `tsc --noEmit`                                                                                                                                    |
| `npm run lint`                       | ESLint (`eslint-config-expo`), incluida la regla que prohíbe AsyncStorage                                                                         |
| `npm run format:check`               | Prettier                                                                                                                                          |
| `npx expo export --platform android` | Ejecuta Metro y compila el bundle a Hermes sin dispositivo (así se verificó que Metro resuelve los paquetes locales)                              |

## Cómo está hecha

- `src/app/`: rutas de Expo Router (delgadas). El grupo `(app)` solo existe con sesión (`Stack.Protected`); sin sesión, solo `login`.
  - **Pestañas** (`src/app/(app)/(tabs)`): Inicio y Movimientos, con el `TabBar` del kit (`src/navigation/app-tab-bar.tsx`). Su tercer destino, Transferir, abre el flujo.
  - **Flujo de transferencia** (`src/app/(app)/transfer/*`): pantallas de la pila fuera de las pestañas (destinatario y envío), así que se ve a pantalla completa, sin la barra. Sigue los pasos Destinatario → Monto → Revisión → Código (si aplica) → Comprobante, con el indicador "Paso n de m".
- **Contenedor y vista:** cada pantalla tiene un contenedor (`*-screen.tsx`), que consulta la API, guarda el estado y navega, y una vista pura (`*-view.tsx`), que solo dibuja con sus props. `src/__tests__/views-are-pure.test.ts` impide que una vista importe navegación, consultas, sesión o módulos nativos, y el lienzo de design-sync (`.design-sync/`) dibuja esas mismas vistas con datos fijos.
- **Encabezado:** `GET /me` da el nombre del saludo ("Hola, Ana") y el correo del menú de la cuenta, que se abre con el avatar. Si falla, saluda sin nombre y lo vuelve a pedir al reintentar o al deslizar en Inicio.
- **Interfaz:** el kit `src/components/ui` (hero del saldo, tarjetas seleccionables, listas agrupadas por día de la Ciudad de México, hojas inferiores, indicador de pasos) solo con los tokens del paquete de diseño. Inicio y Movimientos comparten la cuenta elegida (`src/features/accounts/selection.tsx`), que se olvida al cerrar sesión.
- `src/session/`: el **refresh token** vive en `expo-secure-store` (Keychain/Keystore, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`) y el **access token** solo en memoria. Nunca AsyncStorage: ESLint lo prohíbe y una prueba lo verifica. Al arrancar se restaura la sesión con el refresh guardado.
- `src/api/client.ts`: `createApiClient` del contrato con Bearer desde memoria, plazo de 15 s por intento y **renovación de una sola vez**: tres peticiones vencidas al mismo tiempo hacen una sola llamada a `/auth/refresh`.
- `src/features/transfer/transfer-attempt.ts`: máquina de estados en TypeScript puro. Una `Idempotency-Key` (UUID de `expo-crypto`) por intento y payload congelado; reintentos ante falta de red, tiempo agotado o `5xx` con espera de 1 a 16 s (±20 %) y máximo 5, con la misma llave y los mismos bytes; reintento inmediato cuando NetInfo avisa que volvió la red; estado **incierto** con reintento manual si se agotan. La confirmación del OTP sigue la misma política.
- `src/session/pending-transfer.ts`: **sobrevive a que el sistema mate la app** (MOB-11). Al enviar, la llave, el payload congelado y el borrador se guardan en `expo-secure-store` (mismas opciones que el refresh token) antes de salir la petición. Se borran con cualquier resultado definitivo (la API creó la transferencia, rechazo o error `4xx`, "Corregir"), al cerrar sesión o al iniciar otra, y a las 24 horas. Al abrir la app con sesión, `ResumePendingTransfer` abre el flujo, que repite la misma llave y los mismos bytes: la API responde con el estado real (`Idempotent-Replayed`) y se ve el comprobante, el rechazo o, si sigue sin red, el estado incierto con "Reintentar". Un `429` no la borra (la petición no se ejecutó). Salir del flujo con la transferencia incierta tampoco: se retoma en la siguiente apertura. El plazo de 24 horas lo fija la app: la API no vence la llave (es una columna única de `transfers`, sin TTL ni purga), así que pasado el día se evita reenviar a ciegas un pago viejo y el estado se consulta en Movimientos. Lo guardado no incluye tokens, el código OTP, nombres ni saldos.
- `User-Agent` propio (`src/api/user-agent.ts`): cada petición lleva `TreoWallet-App/<versión> (<ios|android>)`, sin datos del dispositivo. La API lo usa para decir "la app de TreoWallet en Android" en el aviso de inicio de sesión. Que el valor llegue a la API desde un dispositivo real queda pendiente de comprobar.
- Un `429` no cierra la sesión: al renovar conserva el refresh token, y al crear, confirmar o reenviar la transferencia muestra la espera sin reintentar sola.
- Mensajes de error por `code` (RFC 9457) con `problemMessage` del paquete de diseño; montos siempre desde strings con `formatMXN`, sin floats.
- Privacidad: pantalla de privacidad en la raíz al pasar a segundo plano y `expo-screen-capture` mientras hay sesión.
- `src/features/unlock/`: desbloqueo biométrico. `UnlockGate` envuelve la navegación raíz: lee la preferencia y el refresh sin llamar a la API y, con el desbloqueo activo, muestra `LockScreen` antes de montar la navegación (que es la que restaura la sesión); al volver de segundo plano tras 60 s la cubre sin desmontarla. La preferencia está en `src/session/unlock-preference.ts` (almacenamiento seguro y una copia en memoria).

## Desbloqueo biométrico

Bonus del enunciado (MOB-24 a MOB-27) con `expo-local-authentication`. Es opcional y vale para el dispositivo en el que se activa.

- **Activación:** después de iniciar sesión con contraseña, si el teléfono tiene una huella registrada, Inicio muestra la tarjeta "Entrar con tu huella", debajo del saldo, con "Activar" y "Ahora no" (dice "rostro" o "biometría" según el tipo disponible). "Activar" pide la huella y solo con éxito lo activa; "Ahora no" se recuerda hasta el siguiente cierre de sesión. El interruptor "Desbloqueo con huella" ("Desbloqueo con rostro" según el tipo) está en el menú de la cuenta, que se abre con el avatar del encabezado, junto a "Cerrar sesión": lo enciende (pide la huella) o lo apaga (sin pedirla y sin cerrar la sesión). Sin biometría registrada, el interruptor aparece deshabilitado con "Registra una huella en los ajustes de tu teléfono para usar esta opción."
- **Bloqueo:** con el desbloqueo activo y una sesión guardada, la app muestra "TreoWallet está bloqueada" y pide la huella al abrirse en frío, **antes** de renovar la sesión con la API (ninguna petición a `/auth/refresh` hasta el éxito), y al volver de segundo plano después de 60 segundos o más (`LOCK_AFTER_MS` en `unlock-gate.tsx`); una ausencia más corta no la pide. Al volver, la pantalla de privacidad se mantiene hasta que la de bloqueo la sustituye, y la navegación sigue montada debajo: al desbloquear, sigues en la misma pantalla.
- **Alternativas:** el diálogo del sistema acepta el PIN, el patrón o la contraseña del teléfono. "Usar mi contraseña" cierra la sesión como "Cerrar sesión" (pide a la API revocar el refresh y borra los tokens aunque no haya red), desactiva el desbloqueo y lleva al inicio de sesión. Si cancelas el diálogo, la app se queda en la pantalla de bloqueo y no lo vuelve a abrir sola. Con demasiados intentos muestra "Demasiados intentos. Intenta más tarde o usa tu contraseña." con ambas opciones. Si quitaste todas tus huellas, desactiva el desbloqueo, cierra la sesión y pide la contraseña; lo comprueba antes de abrir el diálogo, porque en Android, sin huellas, el diálogo pasaría directo al PIN.
- **Desactivación:** cerrar sesión, una sesión revocada o apagar el interruptor borran la preferencia `treowallet.biometricUnlock` (`enabled` o `declined`). Vive en `expo-secure-store`, junto al refresh token, y nunca contiene tokens ni datos biométricos.

**En Expo Go:**

- En Android, la huella funciona en Expo Go, así que se puede probar sin compilar nada.
- En iOS, Face ID no funciona en Expo Go: necesita un development build. El plugin de `expo-local-authentication` en `app.json` ya declara el texto de `NSFaceIDUsageDescription` para ese build.

**Alcance de seguridad:** es una puerta de la interfaz. Sin desbloquear, la app no restaura la sesión ni muestra datos, pero el refresh token sigue protegido solo por el almacenamiento seguro del sistema (Keychain/Keystore, MOB-02): leerlo no exige la biometría, así que alguien con acceso al sistema de archivos de un teléfono con root podría leerlo, igual que sin esta función. El seguimiento es guardarlo con `requireAuthentication: true` de `expo-secure-store`, que ata la llave a la autenticación del usuario en el Keystore o el Keychain. No se hizo ahora porque en iOS no funciona en Expo Go, porque la llave se invalida cuando cambian las huellas registradas (haría falta un flujo de recuperación) y porque cada renovación de la sesión pediría la huella (`design.md`, D7).

## Verificación manual en Expo Go (pendiente, requiere un teléfono)

Guion del video, contra la API local (tarea 6.3). Antes: API, PostgreSQL y Mailpit arriba, `.env` con la IP de la red local, `npx expo start` y la app abierta en Expo Go.

1. **Inicio de sesión (MOB-01, MOB-22):** sobre la superficie verde de la marca, entra con un usuario del seed. Prueba también una contraseña incorrecta: debe decir "El correo o la contraseña no coinciden." y borrar la contraseña.
2. **Inicio (MOB-05, MOB-19):** arriba, "Hola, <tu nombre>" y el avatar; el saldo total de tus cuentas en el _hero_, con "Disponible hoy" (lo que queda del límite diario) y las acciones Transferir y Movimientos. Debajo, las tarjetas con nombre, CLABE `•••• 1234` y saldo (por ejemplo `$25,000.00`). Toca la otra cuenta: queda seleccionada y "Últimos movimientos" muestra sus últimos 5. Desliza hacia abajo para actualizar.
3. **Movimientos (MOB-06, MOB-20):** toca "Ver todos": se abre la pestaña Movimientos con la cuenta que elegiste en Inicio. El selector de arriba cambia entre Principal y Ahorro. Son los últimos 20, agrupados por día ("Hoy", "Ayer", "9 oct"), con las salidas con `−$` en tinta y las entradas con `+$` en verde.
4. **Transferencia con OTP (MOB-12, MOB-21):** toca Transferir en la barra de pestañas: el flujo ocupa la pantalla, sin la barra, y cada paso dice "Paso n de m". Elige un beneficiario → monto mayor a 10,000.00 (por ejemplo `15000`) → Continuar → la revisión avisa del código → Enviar → abre Mailpit en `http://localhost:8025`, copia el código → Confirmar → comprobante "Completada" con folio y la cuenta de origen con su terminación. "Ver mis cuentas" vuelve a Inicio: el saldo debe estar actualizado.
5. **Saldo insuficiente (MOB-14):** intenta un monto mayor a tu saldo (dentro del límite diario): "No tienes saldo suficiente para esta transferencia." → Corregir regresa al paso del monto.
6. **Modo avión a mitad del envío (MOB-10):** prepara una transferencia de hasta $10,000.00, toca Enviar y activa el modo avión de inmediato. La app muestra "Perdimos la conexión. Reintentaremos la misma operación (N de 5)." Desactiva el modo avión: el reintento sale en ese momento con la misma llave y la app muestra el comprobante (si la API ya la había completado, con el aviso de que ya se había registrado). Revisa en Movimientos que haya **una sola** transferencia.
7. **Privacidad (MOB-16):** con el saldo en pantalla, abre el selector de apps: debe verse la pantalla verde con "TreoWallet" (en Android, la miniatura en blanco).

**Rediseño (MOB-18 a MOB-22).** El lienzo de design-sync dibuja las vistas reales con react-native-web, pero no el motor del teléfono. En Expo Go queda por comprobar:

1. **Fechas en Hermes:** Inicio y Movimientos agrupan por "Hoy", "Ayer" y fechas cortas ("9 oct", "28 dic 2025") igual que en los lienzos. Un movimiento hecho justo después de las 00:00 de la Ciudad de México aparece en "Hoy", y uno de las 23:30 del día anterior, en "Ayer". Las fechas no dependen del ICU de Hermes (`dates.ts` del paquete de diseño trae su tabla de meses y el respaldo UTC−6), pero no se ha probado en el motor.
2. **Texto agrandado:** con el tamaño de texto del sistema al máximo, el saldo de Inicio se reduce para caber en una línea y nunca se corta (`adjustsFontSizeToFit`); las etiquetas de las pestañas y las tarjetas de cuenta siguen legibles.
3. **Foco de las hojas:** con TalkBack o VoiceOver, abrir "Menú de la cuenta" lleva el foco a la hoja, y cerrarla (con el botón o con el gesto de atrás) lo devuelve al avatar.
4. **Atrás de Android:** primero cierra una hoja abierta; en el paso del monto regresa al destinatario; en el destinatario sale del flujo; en una pestaña no cierra la sesión.
5. **Pestañas y área segura:** la barra de pestañas queda sobre la barra de gestos sin un doble espacio; el flujo de transferencia no muestra la barra; Transferir abre el paso del destinatario.
6. **Anuncio del paso:** al pasar a cada paso, el lector de pantalla anuncia "Paso n de m" una sola vez.

## Verificación manual del desbloqueo biométrico (pendiente, requiere un Android con huella)

Tarea 4.2 de `biometric-unlock`, en un Android con al menos una huella registrada y un PIN, con Expo Go. Antes: API, PostgreSQL y Mailpit arriba, `.env` con la IP de la red local, `npx expo start` y la app abierta en Expo Go con la sesión cerrada. Deja a la vista la terminal de la API: cada petición escribe una línea `request completed` con su `path`.

1. **Activar (MOB-24):** inicia sesión con contraseña. En Inicio, debajo del saldo, aparece la tarjeta "Entrar con tu huella". Toca **Activar** y pon tu huella: la tarjeta desaparece y el interruptor "Desbloqueo con huella" queda encendido (está en el menú de la cuenta: toca el avatar del encabezado).
2. **Cerrar y abrir (MOB-25):** **Cierra la app** por completo (desliza Expo Go fuera de las apps recientes) y vuelve a abrir el proyecto desde Expo Go. Debe verse "TreoWallet está bloqueada" con el diálogo de huella, **sin saldos**. En la terminal de la API, la línea con `path` `/auth/refresh` aparece solo después de poner la huella; entonces se ven tus saldos.
3. **Regreso en menos de 60 segundos (MOB-25):** con el saldo en pantalla, ve al inicio del teléfono y regresa en menos de 60 segundos (unos 30): no pide la huella y sigues en la misma pantalla.
4. **Regreso en más de 60 segundos (MOB-25):** abre la pestaña Movimientos, sal al inicio del teléfono y espera más de 60 segundos (unos 90). Al regresar se ve la pantalla de bloqueo (antes, solo la pantalla de privacidad verde) y se abre el diálogo de huella. Con la huella, sigues en Movimientos.
5. **Cancelar (MOB-25):** repite el paso 4 y **Cancela el diálogo** (gesto o botón Atrás). La app se queda en "TreoWallet está bloqueada" con "Desbloquear con huella" y "Usar mi contraseña", sin saldos, y no vuelve a abrir el diálogo sola. "Desbloquear con huella" lo abre de nuevo.
6. **PIN del teléfono (MOB-26):** en el diálogo, elige la opción del sistema para usar el PIN (por ejemplo "Usar PIN") e ingrésalo: también desbloquea.
7. **Usar mi contraseña (MOB-26, MOB-27):** vuelve a bloquear la app (paso 2 o 4) y toca **Usar mi contraseña**: aparece el inicio de sesión y en la terminal de la API se ve `/auth/logout`. Inicia sesión otra vez con contraseña: la tarjeta "Entrar con tu huella" vuelve a aparecer, porque la preferencia se borró. Actívalo de nuevo.
8. **Apagar el interruptor (MOB-27):** en el menú de la cuenta, **Apaga el interruptor** "Desbloqueo con huella": no pide la huella y la sesión sigue abierta. Cierra la app y ábrela: entra directo a tus saldos, sin pedir la huella.
9. **Opcional, demasiados intentos (MOB-26):** con la app bloqueada, pon un dedo no registrado hasta que Android bloquee la huella. Si el sistema lo informa como bloqueo temporal (y no pasa directo al PIN), la app muestra "Demasiados intentos. Intenta más tarde o usa tu contraseña." con ambas opciones.
10. **Opcional, huellas retiradas (MOB-24, MOB-26):** solo si estás dispuesto a borrar tus huellas del teléfono y registrarlas después. Con el desbloqueo activo, borra todas las huellas en los ajustes y abre la app: cierra la sesión y pide la contraseña. Ya con la sesión iniciada, el interruptor del menú de la cuenta aparece deshabilitado con "Registra una huella en los ajustes de tu teléfono para usar esta opción."; al registrar una huella y volver a la app, se habilita.

## Qué haría con más tiempo

La lista está en una sola sección para todo el proyecto: ["¿Qué haría con más tiempo?" del README raíz](../README.md#qué-haría-con-más-tiempo). Lo de la app móvil incluye atar el refresh token a la biometría y llevar a la app lo que hoy solo está en la web. Ya no está en la lista recuperar una transferencia si el sistema operativo mata la app mientras se envía o queda incierta (arriba, `pending-transfer.ts`); lo que sigue pendiente de ese caso es el código OTP: una transferencia que ya está esperando el código no se reabre sola, se encuentra en Movimientos, y la verificación en un dispositivo real queda por hacer.

## Notas

- La salida CommonJS de `@devchrisvaz/wallet-contract` fallaba al llamar a `createApiClient` (interoperabilidad con openapi-fetch); se corrigió en el contrato 1.1.0 (`contract-v1-1`). Metro usa la salida ESM, y `jest.config.js` sigue mapeando el paquete a esa misma salida. Detalle en `design.md` (N1).
- `npm audit` reporta avisos (moderados y altos) en herramientas que llegan como dependencias de `expo` y `react-native` (Expo CLI, Metro, Jest y sus utilidades), que corren en la máquina de desarrollo. `npm audit fix --force` cambiaría versiones fijadas por el SDK, así que se revisan al actualizar el SDK de Expo.
