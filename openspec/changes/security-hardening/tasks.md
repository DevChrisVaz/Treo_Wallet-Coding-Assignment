## 1. Contrato 1.6.0

- [ ] 1.1 [contract] `429` en `logout` con `Retry-After`; versión 1.6.0 y su entrada en los README; pruebas del cliente tipado (CTR-22, IDN-17)

## 2. API: límites de tasa y respuestas sin caché

- [ ] 2.1 [api] Reinstalar el contrato 1.6.0. Seis variables de topes validadas en la configuración (1 a 10000, el error nombra la variable sin su valor), valores por defecto en `.env.example`, y `testConfig` con los cuatro topes de transferencias en 10000; pruebas de configuración (PLT-19, TRF-37)
- [ ] 2.2 [api] Límites por IP de `refresh` y `logout`, cada uno con su contador; pruebas de integración: `429` con `Retry-After`, ventana con el reloj falso, contadores por IP y por operación, el token no se consume (IDN-17, PLT-19)
- [ ] 2.3 [api] Límite por usuario de `POST /transfers` después de autenticar y antes de validar; pruebas de integración: `429`, ventana, usuarios independientes, la repetición de la llave cuenta, sin token no gasta cupo, seis peticiones con la misma llave caben en el tope por defecto (TRF-37, PLT-19)
- [ ] 2.4 [api] Límites por usuario de `confirm`, `otp/resend` y `cancel`; pruebas de integración de cada uno y de que los contadores son independientes por operación (TRF-37, PLT-19)
- [ ] 2.5 [api] `Cache-Control: no-store` en todas las respuestas salvo `/docs` y `/openapi.yaml`; pruebas en éxito (login, `GET /me`), en error (401, 404, 422, 429) y en `/health` (PLT-20)

## 3. API: avisos por correo

- [ ] 3.1 [api] `describeClient` (navegador y sistema, app o "un dispositivo") y `maskIp`; pruebas unitarias con `User-Agent` de Chrome, Firefox, Safari, Edge, Opera, Android, iOS, la app, vacío y enorme (IDN-18)
- [ ] 3.2 [api] `NoticeDispatcher` (envío después del COMMIT sin esperar, falla solo en el log con el destinatario enmascarado, `drain()`) y aviso "Iniciaste sesión en TreoWallet" en el login; pruebas: se envía una vez con el contenido esperado, no en `401`, `403` ni `refresh`, y el correo caído no cambia la respuesta (IDN-18, PLT-16)
- [ ] 3.3 [api] Aviso "Cerramos una sesión por seguridad" al detectar el reuso de un refresh token; pruebas: una vez por familia, no con token desconocido ni en la ventana de gracia (IDN-19)
- [ ] 3.4 [api] Aviso "Agregaste a <alias> como beneficiario" en el `201`; pruebas: no en la repetición `200` ni en `409`, sin la CLABE completa (BEN-12)
- [ ] 3.5 [api] Comprobante al remitente al crear una transferencia a un beneficiario que queda `COMPLETED`; pruebas: contenido, no en la repetición de la llave, no en un traspaso entre cuentas propias, no en un rechazo (TRF-38)
- [ ] 3.6 [api] Comprobante al confirmar con el código; pruebas: una vez, no en la confirmación repetida ni en el código incorrecto, con dos confirmaciones simultáneas solo uno (TRF-38)
- [ ] 3.7 [api] Comprobante cuando el ejecutor de programadas la completa; pruebas: una vez, no en una programada `FAILED`, y `db:seed` y `db:fund` no envían correos (TRF-38)

## 4. Web

- [ ] 4.1 [web] Reinstalar el contrato 1.6.0. Reenviar el `User-Agent` del navegador en cada llamada a la API (también la renovación y las lecturas); pruebas (WEB-10)
- [ ] 4.2 [web] Un `429` al renovar conserva la sesión y se recupera después; un `429` al crear, confirmar o reenviar muestra el mensaje con la espera sin repetir la llamada; pruebas de la renovación, las acciones y los componentes (WEB-40)
- [ ] 4.3 [web] Headers estáticos en `next.config.ts` (`nosniff`, `DENY`, `Referrer-Policy`, `Permissions-Policy`, y HSTS solo con `SESSION_COOKIE_SECURE`); pruebas de configuración (WEB-38)
- [ ] 4.4 [web] Content-Security-Policy con nonce en `proxy.ts`, que conserva `x-wallet-path`; pruebas de las directivas en desarrollo, en producción con HTTPS y en HTTP local, y de que el nonce cambia por petición (WEB-39)
- [ ] 4.5 [web] Prueba e2e que recorre las pantallas públicas y las autenticadas y falla ante cualquier violación de la política, comprueba los headers de WEB-38 y que un script en línea sin nonce no corre; corre toda la suite e2e (WEB-38, WEB-39)
- [ ] 4.6 [web] Verificación de la compilación de producción: `playwright.prod.config.ts` y el script `test:e2e:prod` (`next build` y `next start` contra la API simulada, en puertos propios) con la prueba de 4.5 (WEB-39)

## 5. App móvil

- [ ] 5.1 [mobile] Reinstalar el contrato 1.6.0. Pruebas de que un `429` al renovar no cierra la sesión y de que un `429` al crear, confirmar o reenviar muestra el mensaje con la espera sin reintento automático; corrección si alguna falla (MOB-31)
- [ ] 5.2 [mobile] `User-Agent` `TreoWallet-App/<versión> (<ios|android>)` en cada petición; pruebas (MOB-32)

## 6. Documentación

- [ ] 6.1 [docs] README (configuración, cómo funciona en la API y la web, fila de decisiones, mapa de la especificación), README de la API, de la web y de la app, y propuesta de AWS (límites, headers, la nota del origen del CAPTCHA en la política)
- [ ] 6.2 [docs] "¿Qué haría con más tiempo?" con los quince pendientes nuevos, repartidos en sus subsecciones
- [ ] 6.3 [docs] Matriz de trazabilidad
