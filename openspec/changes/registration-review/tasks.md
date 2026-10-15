Requiere `ux-fixes` (D14 revertida) y `registration-birth-data` (archivado). La tarea 1.1 va antes de que la API, la web y la app usen `REGISTRATION_IN_REVIEW`; la migración (3.1) va antes de las pruebas de integración que la usan.

## 1. Contrato 1.5.0

- [ ] 1.1 [contract] `REGISTRATION_IN_REVIEW` en `ProblemCode` y `403` en `verifyEmail` y `login` con su descripción; versión 1.5.0, su entrada en el README y reinstalación en la API, la web y la app (IDN-06, IDN-08)

## 2. Paquete de diseño 1.4.0

- [ ] 2.1 [design-tokens] Mensaje de `REGISTRATION_IN_REVIEW`; versión 1.4.0 y reinstalación en la API, la web y la app; pruebas (DSG-12)

## 3. API

- [ ] 3.1 [api] Migración: `users.identity_conflict`, índices únicos parciales `uq_users_curp`, `uq_users_rfc` y `uq_users_phone` en lugar de las constraints, y `REGISTRATION_IN_REVIEW` en `ck_audit_log_action`; `down` que se niega con usuarios en revisión; pruebas de esquema (IDN-03, AUD-01)
- [ ] 3.2 [api] Registro con datos de otra cuenta: usuario en revisión con el mismo `202` y el mismo correo con código, también tras la carrera; se retira "No pudimos completar tu registro"; pruebas de integración (IDN-03)
- [ ] 3.3 [api] Verificación de un registro en revisión: `403 REGISTRATION_IN_REVIEW` sin cuentas ni sesión, auditoría con los datos que chocaron y aviso a cada dueño; pruebas de integración (IDN-06, IDN-16, AUD-01)
- [ ] 3.4 [api] Inicio de sesión de un usuario en revisión: `403 REGISTRATION_IN_REVIEW`; pruebas de integración (IDN-08)

## 4. Web

- [ ] 4.1 [web] Verificación con `REGISTRATION_IN_REVIEW`: mensaje del paquete de diseño, sin sesión y con enlace al inicio de sesión; inicio de sesión con el mismo mensaje; API simulada; pruebas de componentes y e2e (WEB-11, WEB-12)

## 5. App móvil

- [ ] 5.1 [mobile] Inicio de sesión con `REGISTRATION_IN_REVIEW`: mensaje del paquete de diseño sin guardar sesión; pruebas (MOB-30)

## 6. Documentación

- [ ] 6.1 [docs] README (registro, contrato, "qué haría con más tiempo"), README de la API (consulta de registros en revisión para soporte), propuesta de AWS, bitácora de AI y matriz de trazabilidad
