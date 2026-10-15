Requiere `ux-fixes`. La tarea 1.1 va antes de que cualquier consumidor instale 1.4.0; la migración (2.2) va antes de las pruebas de integración que la usan.

## 1. Contrato 1.4.0

- [ ] 1.1 [contract] Subir el contrato y su paquete a 1.4.0 y reinstalarlo en la API y la web con `file:../contract` (CTR-02)
- [ ] 1.2 [contract] `BIRTH_STATES` y `BirthState` en `openapi.yaml`, con vectores de paridad (CTR-21)
- [ ] 1.3 [contract] `RegisterRequest` con `firstNames`, `paternalSurname`, `maternalSurname` opcional, `birthDate` y `birthState`; `registerForm` con la coincidencia con la CURP y la edad sobre `birthDate`; pruebas por regla y de paridad (CTR-13)

## 2. API

- [ ] 2.1 [api] Esquema de registro con las mismas reglas y el reloj inyectado; pruebas unitarias de coincidencia, edad y apellido materno ausente (IDN-02)
- [ ] 2.2 [api] Migración `users` con `first_names`, `paternal_surname`, `maternal_surname`, `birth_date` y `birth_state` (`ck_users_birth_state`); SQL directo en la base local para las filas existentes (IDN-02)
- [ ] 2.3 [api] Caso de uso de registro que guarda los campos y compone `full_name`; semillas y fábricas de pruebas; pruebas de integración de cada rechazo (IDN-02)

## 3. Web

- [ ] 3.1 [web] `RegisterForm` con tres campos de nombre, fecha de nacimiento y selector de entidad, validados al salir del campo y con los errores del servidor bajo cada uno; pruebas de componentes (WEB-11)
- [ ] 3.2 [web] Fixtures, fake API y prueba e2e de registro con los campos nuevos (WEB-11)

## 4. Documentación

- [ ] 4.1 [docs] Regenerar `docs/traceability.md` sobre `trace.sh:end` y documentar los campos nuevos en la guía de la API (IDN-02, CTR-13)
