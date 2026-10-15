## Why

El enunciado ofrece como bonus de la app el "desbloqueo biométrico (Face ID / huella)" y el usuario lo eligió. Hoy, quien toma un teléfono desbloqueado con TreoWallet instalada ve los saldos al abrirla, porque la sesión se restaura sola (MOB-02). Un desbloqueo con la biometría del dispositivo cierra ese hueco sin pedir la contraseña cada vez. El usuario lo verificará en un Android con huella en Expo Go.

## What Changes

- **Activación opcional.** Después de iniciar sesión con contraseña, si el dispositivo tiene biometría registrada, la app ofrece "Entrar con tu huella" (o el tipo de biometría disponible). Se activa solo si la autenticación biométrica tiene éxito en ese momento, y se puede activar o desactivar desde la pantalla de inicio.
- **Bloqueo:**
  - **Cuándo:** con el desbloqueo activo y una sesión guardada, la app pide la biometría al abrirse en frío y al volver de segundo plano después de 60 segundos o más.
  - **Antes de qué:** el bloqueo ocurre antes de restaurar la sesión con la API y antes de mostrar cualquier saldo.
  - **Pantalla:** mientras no se desbloquea, una pantalla de bloqueo sin datos de la cuenta.
- **Alternativas:**
  - **Credencial del dispositivo:** el diálogo del sistema acepta el PIN, el patrón o la contraseña del dispositivo.
  - **"Usar mi contraseña":** cierra la sesión (MOB-04), desactiva el desbloqueo y lleva al inicio de sesión.
  - **Biometría retirada:** si el usuario quitó todas sus huellas del dispositivo, la app desactiva el desbloqueo y pide la contraseña.
- **Desactivación automática.** Cerrar sesión, o que la API revoque la sesión, desactiva el desbloqueo y borra su preferencia.

**Proyectos que toca:** `/mobile` y `/docs`.

**Historias de usuario:** ninguna nueva del enunciado. Es el bonus de la app y refuerza la seguridad de HU1 (sesión) en el móvil.

## Capabilities

### New Capabilities
<!-- Ninguna. -->

### Modified Capabilities
- `mobile-app`:
  - activación opcional (MOB-24);
  - bloqueo al abrir y al volver (MOB-25);
  - alternativas y salida (MOB-26);
  - desactivación (MOB-27).

El change `mobile-app` no está archivado, así que este change agrega requisitos con IDs nuevos que indican a cuál amplían, en lugar de deltas `MODIFIED`.

## Impact

- **`/mobile`:**
  - dependencia `expo-local-authentication`, instalada con `npx expo install` para la versión de Expo 57;
  - preferencia en el almacenamiento seguro;
  - puerta de desbloqueo antes de la restauración de la sesión;
  - pantalla de bloqueo;
  - interruptor en la pantalla de inicio;
  - plugin en `app.json` con el texto de Face ID para futuros development builds.
- **Expo Go:**
  - en Android funciona con huella;
  - en iOS, Face ID no funciona en Expo Go: necesita un development build con `NSFaceIDUsageDescription`.

  El README lo documenta.
- **Interacción con `redesign`:** el rediseño mueve la acción de cerrar sesión a un menú del avatar (MOB-18). El interruptor de este change debe moverse a ese menú en la fase de aplicación del rediseño.
- **Alcance de seguridad:** es una puerta de la interfaz. El refresh token sigue protegido por el almacenamiento seguro del sistema (MOB-02), pero no queda atado criptográficamente a la biometría. Atarlo con la autenticación del Keystore o del Keychain queda documentado como seguimiento.
