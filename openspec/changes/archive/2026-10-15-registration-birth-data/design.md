## Context

`ux-fixes` ya valida en el contrato la estructura de la CURP, su fecha de nacimiento, la mayoría de edad y la coincidencia con el RFC. Este change agrega los datos de nacimiento como campos explícitos para contrastarlos con la CURP. Depende de `ux-fixes` (CTR-13, IDN-02 y WEB-11 se modifican sobre su versión).

## Goals / Non-Goals

**Goals:**
- Capturar nombre, apellidos, fecha y entidad de nacimiento por separado y contrastar fecha y entidad con la CURP.
- Que la regla viva una sola vez en el contrato y la API y la web la usen.
- No tocar a los consumidores de `fullName`.

**Non-Goals:**
- Comparar el nombre con las 4 primeras letras de la CURP (descartado: nombres compuestos, partículas, Ñ, palabras inconvenientes).
- Consultar RENAPO; está en «¿Qué haría con más tiempo?» del README.
- Domicilio, perfil económico y cumplimiento; también están en el README.
- Pantalla de registro en la app móvil.

## Decisions

### D1. `fullName` se compone en la API y se sigue guardando
La petición ya no lleva `fullName`. La API une `firstNames`, `paternalSurname` y `maternalSurname` (si existe) con un espacio, y guarda el resultado en `users.full_name`. Las respuestas, los correos, los estados de cuenta y las semillas siguen leyendo `fullName`.

**Alternativas descartadas:**
- Quitar `full_name` y componerlo al leer: toca cada consulta y vista que hoy lo lee, sin ganancia.
- Aceptar `fullName` y los campos nuevos a la vez: dos fuentes para el mismo dato y reglas ambiguas.

### D2. Apellido materno opcional
La CURP usa `X` cuando falta un apellido y hay personas con un solo apellido. `maternalSurname` se puede omitir; el nombre compuesto no deja espacios sobrantes. Cada parte usa las reglas de `PersonName` por palabra: solo letras, apóstrofo, guion y punto, sin espacios en los extremos.

### D3. La entidad es un código del catálogo de la CURP
`birthState` es uno de los 33 códigos de dos letras que acepta el patrón de la CURP (`AS`, `BC`, … `ZS` y `NE`). El catálogo `BIRTH_STATES` asocia cada código con su nombre y es la única lista del repositorio: el patrón de la CURP y el selector de la web la leen de ahí.

### D4. Contraste con la CURP en el contrato
`curpBirthDate` ya extrae la fecha; se agrega `curpBirthState` para los caracteres 12 y 13. `registerForm` compara solo cuando la CURP, por separado, ya es válida (igual que la regla del RFC) y reporta en `/birthDate` o `/birthState`. La edad se calcula sobre `birthDate`, que coincide con la de la CURP, así que el error de edad pasa de `/curp` a `/birthDate`.

**Alternativa descartada:** preseleccionar fecha y entidad desde la CURP en la web. Si el formulario las rellena, ya no hay dato independiente que contrastar.

### D5. Migración sin relleno
No hay usuarios que conservar: es un ambiente de pruebas. La migración agrega las cinco columnas `NOT NULL` sin valor por defecto, con `ck_users_birth_state` sobre el catálogo. En la base local, antes de migrar, las filas existentes se corrigen con SQL directo (se borran o se rellenan desde la CURP); la migración no lleva lógica de relleno. Las semillas (`demo-users`, `generated-users`) generan nombre, apellidos, fecha y entidad coherentes con cada CURP.

**Alternativas descartadas:** columnas nulas con relleno en la migración, que dejarían datos opcionales sin necesidad.

### D6. Orden de trabajo
Contrato 1.4.0 primero y reinstalado en la API y la web; luego la migración y el caso de uso; al final la web.

## Risks / Trade-offs

- **`fullName` pierde su regla de dos palabras como entrada.** Se conserva implícita: nombre y apellido paterno son obligatorios, así que el compuesto siempre tiene al menos dos palabras.
- **Una persona con la fecha o la entidad de su CURP corregida por RENAPO** no podrá registrarse hasta tener una CURP vigente. Es lo esperado: la validación es de coherencia, no de identidad.
- **Cambio incompatible en `POST /auth/register`.** Aceptable: el contrato es 1.x en pruebas y los únicos clientes son la web y el fake API.
