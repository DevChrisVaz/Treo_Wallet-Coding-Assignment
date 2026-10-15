## Why

Un registro con email nuevo cuya CURP, RFC o teléfono ya son de otra cuenta responde `202` como cualquier registro, pero al correo llega "No pudimos completar tu registro" en lugar de un código (IDN-03). Quien controla ese correo sabe así que el dato ya tiene cuenta: con variantes como `nombre+1@`, un solo buzón sirve para preguntar por muchas personas si son clientes. Antes, D14 de `ux-fixes` lo decía en el formulario, y se revirtió por lo mismo.

Este change hace que ese registro siga el mismo camino que cualquier otro hasta que el correo se comprueba: mismo `202`, mismo correo con código. Al verificar, en lugar de abrir las cuentas, el registro queda **en revisión** y el dueño real de los datos recibe un aviso. La diferencia con un registro normal ya no se ve desde el formulario ni desde el correo, solo después de comprobar el correo, y cada intento queda auditado y llega al dueño.

## What Changes

- **Registro (IDN-03).** Con datos de otra cuenta, la API crea al usuario marcado en revisión, sin cuentas, responde el mismo `202` y envía el mismo correo con código. Se retira el aviso "No pudimos completar tu registro". La CURP, el RFC y el teléfono siguen siendo únicos entre los usuarios que no están en revisión.
- **Verificación (IDN-06).** Con el código correcto, un registro en revisión marca el correo como verificado, no abre cuentas ni sesión y responde `403 REGISTRATION_IN_REVIEW`.
- **Aviso al dueño (IDN-16, nuevo).** Al verificarse un registro en revisión, cada usuario activo dueño de un dato que chocó recibe "Alguien intentó registrarse con tus datos".
- **Inicio de sesión (IDN-08).** Un usuario en revisión con la contraseña correcta recibe `403 REGISTRATION_IN_REVIEW`.
- **Auditoría (AUD-01).** Nuevo evento `REGISTRATION_IN_REVIEW`, con qué datos chocaron.
- **Contrato 1.5.0.** `REGISTRATION_IN_REVIEW` en `ProblemCode` y el `403` en `verifyEmail` y `login`.
- **Paquete de diseño 1.4.0 (DSG-12).** El mensaje de `REGISTRATION_IN_REVIEW`.
- **Web (WEB-11, WEB-12) y app (MOB-30, nuevo).** Muestran que el registro está en revisión, sin iniciar sesión.

La resolución de cada registro en revisión queda fuera del producto: la hace soporte.

## Capabilities

### New Capabilities
Ninguna.

### Modified Capabilities
- `identity`: unicidad y registro con datos de otra cuenta (IDN-03), verificación (IDN-06), inicio de sesión (IDN-08) y el aviso al dueño de los datos (IDN-16, nuevo).
- `audit-trail`: catálogo de eventos (AUD-01).
- `design-system`: textos de error (DSG-12).
- `web-app`: registro y verificación (WEB-11) e inicio de sesión (WEB-12).
- `mobile-app`: registro en revisión al iniciar sesión (MOB-30, nuevo).

## Impact

- **Proyectos:** `/contract`, `/design-tokens`, `/api`, `/web`, `/mobile` y `/docs`.
- **Historias de usuario:** HU1 (registro e inicio de sesión).
- **`/contract`:** `openapi.yaml` 1.5.0 y los tipos generados.
- **`/design-tokens`:** `copy.ts` y la versión 1.4.0.
- **`/api`:** una migración (`users.identity_conflict`, índices únicos parciales en lugar de las constraints únicas de la CURP, el RFC y el teléfono, y el evento en `ck_audit_log_action`), los casos de uso de registro, verificación e inicio de sesión, y una plantilla de correo.
- **`/web`:** la verificación y el inicio de sesión.
- **`/mobile`:** el inicio de sesión.
- **`/docs`:** README, propuesta de AWS y bitácora de AI.
