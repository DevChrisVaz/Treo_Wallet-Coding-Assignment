## Why

El registro pide un solo campo de nombre y toma la fecha de nacimiento únicamente de la CURP. Un banco captura los apellidos por separado, la fecha de nacimiento y la entidad de nacimiento, y los contrasta con la CURP, que ya los codifica (fecha en las posiciones 5 a 10, entidad en las 12 y 13). Pedirlos explícitos permite detectar una CURP mal capturada o ajena sin consultar fuentes externas, que `ux-fixes` dejó fuera de alcance.

## What Changes

- **Nombre separado.** El registro pide `firstNames`, `paternalSurname` y `maternalSurname` (opcional) en lugar de `fullName`. La API compone el nombre completo y lo sigue guardando y devolviendo como `fullName`; el resto de la app no cambia.
- **Fecha y entidad de nacimiento.** El registro pide `birthDate` (`YYYY-MM-DD`) y `birthState` (código de entidad de la CURP, con `NE` para nacido en el extranjero).
- **Coincidencia con la CURP.** La fecha y la entidad deben ser las que codifica la CURP; si no, error por campo en `/birthDate` o `/birthState`. La mayoría de edad se mide sobre `birthDate`.
- **Catálogo.** El contrato exporta `BIRTH_STATES` (código y nombre de las 33 entidades) para los formularios.
- **Web.** El formulario sustituye el campo de nombre por tres y agrega fecha y entidad.
- **Contrato 1.4.0.** Cambia `RegisterRequest`; la API y la web lo reinstalan.

**Proyectos que toca:** `/contract`, `/api`, `/web` y `/docs`. `/mobile` y `/design-tokens` no cambian: la app no tiene registro.

**Historias de usuario:** HU1 (registro).

## Capabilities

### New Capabilities
<!-- Ninguna. -->

### Modified Capabilities
- `api-contract`: formulario de registro (CTR-13) y catálogo de entidades de nacimiento (CTR-21, nuevo).
- `identity`: datos obligatorios del registro (IDN-02).
- `web-app`: registro (WEB-11).

## Impact

- **`/contract`:** `openapi.yaml` (1.4.0: `RegisterRequest`, `BirthState`, `BirthDate`), validadores (`registerForm`, `curpBirthState`, `BIRTH_STATES`), vectores de paridad y pruebas por regla.
- **`/api`:** migración que agrega `first_names`, `paternal_surname`, `maternal_surname`, `birth_date` y `birth_state` a `users`; caso de uso de registro; semillas y fábricas de pruebas.
- **`/web`:** `RegisterForm`, fixtures, fake API y prueba e2e de registro.
- **`/docs`:** matriz de trazabilidad.
