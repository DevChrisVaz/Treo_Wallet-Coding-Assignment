## Why

Una revisión de seguridad del código encontró cuatro brechas que no cambian lo que hace el producto, pero sí lo que un atacante o un descuido pueden provocar:

1. **Rutas sin límite de tasa.** `refresh`, `logout` y las cuatro operaciones de transferencias (crear, confirmar, reenviar el código y cancelar) no tienen límite. Un cliente con una sesión válida puede inundar la API con transacciones que bloquean filas, y un atacante puede hacer lo mismo con `refresh` sin ninguna sesión.
2. **Respuestas que un caché puede guardar.** Solo el estado de cuenta envía `Cache-Control: no-store`. Los tokens de `/auth/*`, los datos de `/me`, las cuentas y los movimientos podrían quedar en el caché de un proxy intermedio o del navegador.
3. **La web no envía ningún header de seguridad.** Sin Content-Security-Policy, un fallo de inyección en el HTML se convierte en ejecución de código; sin `X-Frame-Options` ni `frame-ancestors`, la web puede incrustarse en otro sitio.
4. **La persona no se entera de lo que pasa en su cuenta.** Un inicio de sesión, el cierre de una sesión por reuso de un token, el alta de un beneficiario y una transferencia a un tercero cambian algo que importa, y hoy no dejan ningún aviso. Si alguien entra con la contraseña de otra persona, ella lo descubre cuando ve el saldo.

Este change cierra las cuatro. Además lista en el README, de forma honesta, lo que no cubre (segundo factor, rotación del secreto del JWT, revocación inmediata del access token, monitoreo de fraude y otros), para que lo pendiente quede escrito y no solo en la cabeza de quien lo revisó.

## What Changes

- **Límites de tasa (PLT-19, IDN-17, TRF-37).** `POST /auth/refresh` y `POST /auth/logout` por IP; crear, confirmar, reenviar el código y cancelar una transferencia por usuario autenticado. Los topes se configuran con variables de entorno validadas al arrancar y tienen margen para los reintentos legítimos, incluida la misma llave de idempotencia reenviada por la app.
- **`Cache-Control: no-store` (PLT-20).** En todas las respuestas de la API, también en los errores y en los 404, salvo la documentación navegable del contrato.
- **Headers de seguridad en la web (WEB-38, WEB-39).** Content-Security-Policy con nonce por petición generado en `proxy.ts`, y en toda respuesta `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` y `Permissions-Policy`; `Strict-Transport-Security` solo con HTTPS. Una prueba e2e falla ante cualquier violación de la política, y la compilación de producción se verifica igual.
- **Avisos por correo (IDN-18, IDN-19, BEN-12, TRF-38, PLT-16).** Cada inicio de sesión con contraseña, el cierre de una sesión por reuso del refresh token, el alta de un beneficiario y cada transferencia a un tercero completada (comprobante al remitente). Salen después del COMMIT y una falla del envío solo se registra.
- **La web reenvía el `User-Agent` del navegador (WEB-10)** para que el aviso de inicio de sesión y la bitácora (`audit_log.user_agent`) hablen del cliente real, y **la app se identifica con el suyo (MOB-32)**.
- **Clientes ante un `429` (WEB-40, MOB-31).** Un `429` al renovar no cierra la sesión, y un `429` al crear, confirmar o reenviar muestra el mensaje con la espera y no se reintenta como si fuera un `5xx`.
- **Contrato 1.6.0 (CTR-22).** `429` declarado también en `logout`.
- **Documentación.** README (configuración, cómo funciona, decisiones, mapa de la especificación y quince pendientes nuevos en "¿Qué haría con más tiempo?"), READMEs de los proyectos, propuesta de AWS (límites, headers, la nota del CAPTCHA) y matriz de trazabilidad.

## Capabilities

### New Capabilities
Ninguna.

### Modified Capabilities
- `api-platform`: límites configurables (PLT-19, nuevo), respuestas sin caché (PLT-20, nuevo) y avisos en la entrega de correo (PLT-16).
- `identity`: límites de refresh y logout (IDN-17, nuevo), aviso de inicio de sesión (IDN-18, nuevo) y aviso de sesión cerrada por reuso (IDN-19, nuevo).
- `beneficiaries`: aviso del alta (BEN-12, nuevo).
- `transfers`: límites de tasa (TRF-37, nuevo) y comprobante al remitente (TRF-38, nuevo).
- `api-contract`: `429` en `logout` (CTR-22, nuevo).
- `web-app`: propagación del `User-Agent` (WEB-10), headers estáticos (WEB-38, nuevo), CSP con nonce (WEB-39, nuevo) y `429` sin efectos sobre la sesión ni reintentos (WEB-40, nuevo).
- `mobile-app`: `429` (MOB-31, nuevo) y el `User-Agent` de la app (MOB-32, nuevo).

## Impact

- **Proyectos:** `/contract`, `/api`, `/web`, `/mobile` y `/docs`. `/design-tokens` no cambia: `RATE_LIMITED` ya tiene mensaje.
- **Historias de usuario:** HU1 (inicio de sesión y sesiones), HU3 (beneficiarios) y HU4 (transferencias). Es una mejora transversal de seguridad, sin historia propia.
- **`/contract`:** `openapi.yaml` 1.6.0 y los tipos generados.
- **`/api`:** seis variables de entorno nuevas; un middleware de `no-store`; límites en las rutas de identidad y de transferencias; cuatro plantillas de correo y un despachador de avisos; sin migraciones.
- **`/web`:** `next.config.ts`, `proxy.ts`, el cliente de la API (`User-Agent`), una prueba e2e de la política y la verificación del build de producción.
- **`/mobile`:** el `User-Agent` de la app y pruebas del `429`.
- **`/docs`:** README, READMEs de la API, la web y la app, propuesta de AWS y matriz de trazabilidad. La bitácora de AI la escribe quien revisa.
Requiere `registration-review` (contrato 1.5.0, aviso al dueño de los datos). La tarea 1.1 cambia solo el paquete; cada consumidor lo reinstala en su primera tarea (2.1, 4.1 y 5.1). La configuración de las pruebas de la API sube los límites de transferencias para que las pruebas de concurrencia sigan afirmando lo mismo (D2).
