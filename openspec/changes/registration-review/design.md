## Context

IDN-03 obliga a que la CURP, el RFC y el teléfono sean únicos. Hasta este change, un registro que choca con ellos responde `202` y manda "No pudimos completar tu registro" al correo escrito, sin crear nada. La respuesta HTTP no distingue el caso, pero el correo sí, y quien lo escribió lo controla. La revisión de seguridad que llevó a revertir D14 de `ux-fixes` lo señaló.

Se eligió, entre las opciones que se plantearon, mandar a revisión **solo** los registros que chocan. Los demás siguen abriendo sus cuentas al verificar el correo, como hoy.

## Goals / Non-Goals

**Goals:**
- Que la respuesta del registro y el correo que llega sean idénticos con datos nuevos o con datos de otra cuenta.
- Que el dueño real de los datos se entere cuando alguien comprueba un correo con ellos.
- Que cada intento quede en la bitácora con los datos que chocaron, sin datos personales.

**Non-Goals:**
- Resolver los registros en revisión desde el producto. Lo hace soporte (ver D6).
- Ocultar la revisión también después de verificar el correo. Para eso todos los registros tendrían que pasar por revisión (alternativa descartada en D1).
- Limitar los intentos por dato de identidad. El límite de 10 registros por hora por IP (IDN-15) se mantiene.

## Decisions

### D1. Revisión solo para los registros que chocan
Con datos de otra cuenta, el registro sigue el camino normal hasta la verificación del correo y ahí queda en revisión.

**Alternativas descartadas:**
- **Revisión para todos los registros.** Es la única forma de que nada distinga el caso, ni siquiera después de verificar, pero obliga a que una persona apruebe cada alta, incluida la demo y el video. No compensa en esta etapa.
- **Error por campo** (`422 ALREADY_REGISTERED`, D14 de `ux-fixes`). Revela el dato al instante, sin correo. Se revirtió.
- **Aviso genérico por correo** (IDN-03 de `api-foundation`). Revela el dato a quien controla el correo, en un paso.

**Lo que queda:** quien comprueba el correo ve "en revisión" en lugar de sus cuentas, y así sabe que algún dato ya tenía cuenta. Cuesta un buzón real y un código por intento, cada intento queda auditado, y el dueño de los datos recibe un aviso (D4).

### D2. Usuario marcado en revisión dentro de `users`
El registro en revisión es una fila de `users` con `identity_conflict = true`. Así usa sin cambios el código de verificación, los reenvíos, el bloqueo de la fila y la unicidad del email. La unicidad de la CURP, el RFC y el teléfono pasa de constraints a índices únicos parciales (`WHERE NOT identity_conflict`) con los mismos nombres (`uq_users_curp`, `uq_users_rfc`, `uq_users_phone`), así que la traducción de errores de PostgreSQL por nombre no cambia. El email sigue siendo único entre todos los usuarios.

El pre-chequeo (`identityInUse`) solo mira usuarios activos: un registro que choca con otro en revisión no queda en revisión por eso.

**Alternativa descartada:** una tabla aparte de registros en revisión. Mantiene `users` sin excepciones a la unicidad, pero duplica la emisión y verificación de códigos, los reenvíos y sus límites, que hoy dependen del id del usuario.

### D3. Verificación y sesión de un registro en revisión
Con el código correcto, en la misma transacción, la API marca el correo como verificado y consume el código, **no** abre "Principal" ni "Ahorro", **no** crea la familia de refresh y audita `REGISTRATION_IN_REVIEW` con `curpTaken`, `rfcTaken` y `phoneTaken`. Después del `COMMIT` responde `403 REGISTRATION_IN_REVIEW` y envía los avisos (D4).

Un inicio de sesión posterior con la contraseña correcta responde lo mismo. Con la contraseña incorrecta sigue siendo `401 INVALID_CREDENTIALS`, así que la revisión solo se le muestra a quien conoce la contraseña.

**Por qué `403` y no un `200` con otro cuerpo:** las dos pantallas ya muestran problemas por `code`, y `403 EMAIL_NOT_VERIFIED` es el mismo tipo de situación: el correo y la contraseña son correctos, pero la cuenta todavía no se puede usar.

### D4. Aviso al dueño de los datos, solo al verificar
Se avisa al verificar, no al registrar. Si se avisara en cada registro, cualquiera podría llenar el buzón del dueño con correos inventados que nunca se verifican. Al verificar, quien probó ya demostró que controla un correo.

El aviso va a cada usuario **activo** (no en revisión) dueño de algún dato que chocó, una sola vez aunque choquen varios suyos. No dice qué dato fue ni el correo de quien lo intentó: solo que alguien intentó registrarse con sus datos y qué hacer si no fue esa persona. Se envía después del `COMMIT` (PLT-16); si falla, se registra en el log como cualquier correo.

### D5. Carrera entre dos registros con el mismo dato
Si dos registros con emails nuevos y el mismo RFC pasan el pre-chequeo a la vez, el índice único detiene al segundo. La API lo repite como registro en revisión, en una transacción nueva. El resultado es el mismo que si hubiera llegado después.

### D6. La resolución queda fuera del producto
Soporte lista los registros en revisión con una consulta (en el README de la API) y decide con el dueño de los datos. Por ejemplo, si la persona que se registró es la dueña real y la cuenta existente es de un tercero. No hay endpoint ni pantalla de administración: se agregaría con un rol de soporte, que hoy no existe.

### D7. Versiones
El contrato pasa a 1.5.0 (un `ProblemCode` nuevo) y el paquete de diseño a 1.4.0 (su mensaje). Como en D13 de `ux-fixes`, los consumidores viven en este repositorio y se reinstalan en el mismo change.

## Risks / Trade-offs

- **La revisión se ve después de verificar** (D1). Es el costo de no revisar todos los registros.
- **Un tercero puede registrarse primero con los datos de otra persona.** Entonces la dueña real es la que queda en revisión, y el aviso le llega al tercero. Ninguna variante sin verificar la identidad (por ejemplo, contra RENAPO) lo evita; queda en "qué haría con más tiempo".
- **Registros en revisión que se acumulan.** Cada uno ocupa un email y una fila sin cuentas. Su retención y su borrado los define soporte con cumplimiento.
- **`down` de la migración.** Se niega mientras exista un usuario en revisión, porque volver a las constraints únicas fallaría con duplicados.
