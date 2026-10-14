## 1. Base

- [x] 1.1 [mobile] Instalar `expo-local-authentication` con `npx expo install`, declarar su plugin en `app.json` y agregar su simulación configurable a `native-mocks`; las pruebas vigentes siguen pasando (MOB-24)
- [x] 1.2 [mobile] Preferencia `treowallet.biometricUnlock` en el almacenamiento seguro (`enabled`, `declined` o vacía) y su borrado en `logout` y en la sesión revocada; pruebas de que nunca contiene un token y de que se borra en ambos casos (MOB-24, MOB-27)

## 2. Puerta y pantalla de bloqueo

- [ ] 2.1 [mobile] `UnlockGate` antes de `RootNavigator`: con la preferencia activa y un refresh token, `LockScreen` y diálogo biométrico antes de restaurar; prueba de que la API falsa no recibe la renovación hasta el éxito; sin preferencia, la restauración de MOB-02 no cambia (MOB-25)
- [ ] 2.2 [mobile] `LockScreen` con "Desbloquear con <tipo>" y "Usar mi contraseña", un solo diálogo automático y los resultados de D5 (cancelación, bloqueo temporal, sin registro, error desconocido); pruebas de cada resultado y de que no muestra datos de la cuenta (MOB-25, MOB-26)
- [ ] 2.3 [mobile] Bloqueo al volver de segundo plano con 60 segundos o más (reloj inyectado), sin bloqueo con menos, con la pantalla de privacidad hasta que la pantalla de bloqueo la sustituye; las pruebas de MOB-16 siguen pasando (MOB-25)
- [ ] 2.4 [mobile] "Usar mi contraseña" y biometría retirada: cierre de sesión como MOB-04 (con y sin red), preferencia borrada e inicio de sesión (MOB-26, MOB-27)

## 3. Activación

- [ ] 3.1 [mobile] Tarjeta "Entrar con tu <tipo>" después del inicio de sesión con "Activar" (solo con éxito biométrico) y "Ahora no" (guardado hasta el siguiente cierre de sesión); pruebas de los escenarios de MOB-24 (MOB-24)
- [ ] 3.2 [mobile] Interruptor "Desbloqueo con <tipo>" en la pantalla de inicio: encender pide biometría, apagar borra la preferencia, deshabilitado con explicación sin biometría registrada; pruebas de accesibilidad del interruptor (MOB-24, MOB-27)

## 4. Documentación y verificación

- [ ] 4.1 [docs] README de la app: desbloqueo biométrico, comportamiento en Expo Go (huella en Android sí; Face ID en iOS requiere development build) y el alcance de seguridad con su seguimiento (MOB-24, MOB-25)
- [ ] 4.2 [docs] Verificación manual en el Android del usuario con Expo Go: activar, cerrar y abrir la app, volver de segundo plano antes y después de 60 segundos, cancelar el diálogo, "Usar mi contraseña" y apagar el interruptor (MOB-24, MOB-25, MOB-26, MOB-27)
