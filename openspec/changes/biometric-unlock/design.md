## Context

La app arranca así: `RootLayout` (fuentes → `PrivacyGuard` → configuración → proveedores) → `RootNavigator`, que llama a `restoreSession`. Esa función lee el refresh token del almacenamiento seguro y lo renueva con la API (MOB-02). `PrivacyGuard` cubre el contenido cuando la app deja de estar activa (MOB-16). El cierre de sesión está en la pantalla de inicio (`features/accounts/home-screen.tsx`).

El usuario prueba en un Android con huella en Expo Go.

## Goals / Non-Goals

**Goals:**
- Una puerta biométrica antes de la restauración de la sesión y al volver de segundo plano.
- Alternativas claras: la credencial del dispositivo y la contraseña.
- Pruebas de todos los escenarios en Jest, simulando el módulo nativo, `AppState` y el reloj.

**Non-Goals:**
- Atar criptográficamente el refresh token a la biometría (seguimiento, D7).
- Biometría para confirmar transferencias en lugar del OTP. El OTP lo exige el servidor y no cambia.
- La versión web.

## Decisions

### D1. `expo-local-authentication`
Es el módulo oficial de Expo y funciona en Expo Go con huella en Android. Se instala con `npx expo install expo-local-authentication`, que fija la versión de Expo 57. La API exacta se consulta con su documentación actual al implementar.

Las funciones que se usan son:
- `hasHardwareAsync` e `isEnrolledAsync`, para saber si se puede ofrecer;
- `supportedAuthenticationTypesAsync`, para el nombre del tipo: huella, rostro o biometría;
- `authenticateAsync`, con mensaje en español, la etiqueta de cancelar y la credencial del dispositivo permitida.

El plugin del módulo se declara en `app.json` con el texto de Face ID para un development build futuro.

*Alternativa descartada:* `react-native-biometrics`. No funciona en Expo Go y obligaría a un development build para probar en el teléfono del usuario.

### D2. Puerta antes de la restauración
Un componente `UnlockGate` envuelve a `RootNavigator` dentro de los proveedores. Al montar, lee la preferencia y si existe un refresh token, sin hacer ninguna petición:
- **Sin preferencia activa o sin token:** deja pasar, y `RootNavigator` restaura como hoy.
- **Con preferencia activa y token:** muestra `LockScreen` y abre el diálogo biométrico. Solo al tener éxito monta `RootNavigator`, que entonces restaura la sesión.

Así se cumple que no haya ninguna renovación antes de desbloquear (MOB-25), sin tocar `restoreSession`.

*Alternativa descartada:* pedir la biometría dentro de `restoreSession`. Mezclaría una decisión de interfaz con la lógica de sesión, que hoy es pura y está probada.

### D3. Preferencia en el almacenamiento seguro
La clave es `treowallet.biometricUnlock` en `expo-secure-store` y toma uno de dos valores: `enabled` o `declined`. Sin valor, la app no ha preguntado. La preferencia no es un secreto, pero vive en el mismo almacenamiento que el refresh token para compartir su ciclo de vida: se borra en `logout` y al marcar la sesión como revocada. Una prueba verifica que el valor nunca contiene un token.

*Alternativa descartada:* AsyncStorage. Sería una dependencia nueva solo para una bandera, y quedaría fuera del borrado conjunto con la sesión.

### D4. Tiempo en segundo plano
Un hook escucha `AppState`:
- **Al pasar a `background`:** guarda el instante en memoria. `inactive` no cuenta, porque iOS lo emite al abrir el centro de control.
- **Al volver a `active`:** si el desbloqueo está activo, hay sesión y pasaron 60 segundos o más, marca la app como bloqueada y `UnlockGate` muestra `LockScreen` encima de la navegación, sin desmontarla.

`PrivacyGuard` sigue cubriendo mientras la app no está activa, así que nunca se ve contenido entre el regreso y el bloqueo. El reloj se inyecta para las pruebas.

*Alternativa descartada:* bloquear siempre al volver. Pedir la huella por contestar un mensaje de 5 segundos se vuelve molesto, y los bancos usan un margen parecido.

### D5. Pantalla de bloqueo y resultados del diálogo
`LockScreen` muestra:
- la marca;
- el texto "TreoWallet está bloqueada";
- los botones "Desbloquear con <tipo>" y "Usar mi contraseña".

Pide la biometría una vez al aparecer. Después, solo cuando se pulsa el botón; así se evita un ciclo de diálogos si el usuario cancela.

El resultado de `authenticateAsync` se traduce así:

| Resultado | Acción |
|---|---|
| Éxito | Desbloquea |
| `user_cancel`, `system_cancel`, `app_cancel` | Se queda en la pantalla |
| `lockout` | Muestra "Demasiados intentos. Intenta más tarde o usa tu contraseña." |
| `not_enrolled`, `passcode_not_set` o sin hardware | Desactiva el desbloqueo, cierra la sesión y lleva al inicio de sesión (MOB-26) |
| Cualquier otro error | Muestra un mensaje genérico y conserva ambas opciones |

### D6. Ofrecer y activar
Después del inicio de sesión exitoso (MOB-01), y solo si la preferencia está vacía y el dispositivo tiene biometría registrada, la pantalla de inicio muestra una tarjeta "Entrar con tu huella", con "Activar" y "Ahora no". Una tarjeta es mejor que un diálogo modal: no interrumpe y es accesible con el lector de pantalla.

El interruptor "Desbloqueo con <tipo>" en la pantalla de inicio sigue estas reglas:
- encenderlo pide la biometría;
- apagarlo borra la preferencia;
- sin biometría registrada, aparece deshabilitado con el texto "Registra una huella en los ajustes de tu teléfono para usar esta opción."

### D7. Alcance de seguridad y seguimiento
La puerta protege la interfaz: sin desbloquear, la app no restaura la sesión ni muestra datos. Pero el refresh token sigue en el almacenamiento seguro sin requerir biometría para leerse. Un atacante con acceso al sistema de archivos de un teléfono con root podría leerlo, igual que hoy.

El seguimiento documentado es guardar el refresh token con `requireAuthentication: true` de `expo-secure-store`, que ata la llave a la autenticación del usuario en el Keystore o el Keychain. No se hace ahora por tres razones:
- en iOS no funciona en Expo Go;
- invalida la llave cuando cambian las huellas registradas, y eso exige un flujo de recuperación;
- cada renovación pediría la biometría.

### D8. Pruebas
- **Simulación:** `expo-local-authentication` se simula en `src/test-utils/native-mocks.ts`; se puede configurar el hardware, el registro, el tipo y el resultado del diálogo.
- **`AppState`:** se usa el ayudante existente de `test-utils/app-state.ts` con un reloj falso.
- **Cobertura:** cada escenario de MOB-24 a MOB-27, con atención especial a uno: con el desbloqueo activo, la API falsa no recibe la renovación hasta que el diálogo tiene éxito.
- **Regresión:** las pruebas vigentes de MOB-01 a MOB-04 y MOB-16 siguen pasando.

## Risks / Trade-offs

- **[Riesgo] Diferencias entre fabricantes de Android** en el diálogo y en los códigos de error. Mitigación: tratar cualquier error desconocido como "quedarse en la pantalla de bloqueo" con ambas opciones, y la verificación manual en el teléfono del usuario.
- **[Riesgo] Conflicto con la rama del rediseño** en la pantalla de inicio y el `_layout`. Mitigación: `UnlockGate`, `LockScreen` y el interruptor son componentes aparte; el rediseño solo los reubica.
- **[Trade-off] El margen de 60 segundos** deja una ventana corta en la que alguien puede tomar el teléfono desbloqueado. Se acepta por usabilidad; el valor es una constante documentada.
