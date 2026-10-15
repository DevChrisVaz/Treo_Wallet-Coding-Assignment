## Context

El contrato 1.2.0, la API, la web y la app ya cubren el alcance del enunciado y los bonus. Este change recoge diez ajustes de uso que cambian reglas especificadas. Ninguno agrega un módulo nuevo: casi todo es validación compartida entre `/contract`, `/api`, `/web` y `/mobile`, más dos pantallas nuevas ("Recibir dinero" y la búsqueda de beneficiarios).

Una restricción ordena el trabajo: la regla se escribe una vez en el contrato y las demás partes la usan. La API valida con las mismas reglas que los formularios, y las pruebas de paridad comprueban que el esquema de `openapi.yaml` y el validador del paquete aceptan y rechazan los mismos vectores.

## Goals / Non-Goals

**Goals:**
- Que nadie pueda escribir en un campo lo que el contrato va a rechazar, y que el error aparezca al salir del campo.
- Que las reglas del registro, de la referencia y de la programación sean idénticas en el contrato, la API y los formularios.
- Que la web y la app sigan en paridad en las pantallas que tienen en común (Inicio, destinatario, campos).

**Non-Goals:**
- Registro, programación y estado de cuenta en la app móvil: la app no tiene esas pantallas y este change no las agrega.
- Verificar la identidad contra registros oficiales: la CURP y el RFC se validan solo por estructura, fecha y coincidencia entre ellos.
- Búsqueda en el servidor: la lista de beneficiarios no está paginada.
- Cambiar `/design-tokens`: los textos nuevos son de pantalla.

## Decisions

### D1. `PersonName` separado de `FullName`
El nombre del titular al registrarse pasa a un schema nuevo, `PersonName`: de 2 a 100 caracteres, al menos dos palabras separadas por un solo espacio, sin espacios en los extremos y solo letras Unicode (con acentos y ñ), apóstrofo, guion y punto. `FullName` se queda como está en los beneficiarios.

**Por qué.** Un beneficiario puede ser un negocio ("Tienda 24", "Taquería El Güero #3"), que no cumple las reglas de una persona. Endurecer `FullName` rompería beneficiarios válidos y datos ya guardados.

**Alternativas descartadas:**
- Endurecer `FullName` para todos: rechaza nombres de negocios y obliga a migrar datos.
- Validar solo en la web: la API quedaría permisiva y la regla se saltaría con una petición directa.

### D2. Contraseña, correo y teléfono
- Contraseña: de 12 a 128 caracteres (puntos de código) con al menos una letra y un dígito. IDN-02 decía "sin reglas de composición"; se cambia porque el producto pidió una mínima.
- Correo: se recorta y se pasa a minúsculas antes de validarlo y guardarlo, a lo más 254 caracteres.
- Teléfono: exactamente 10 dígitos y el primero de 2 a 9, porque los números nacionales no empiezan con 0 ni 1.
- La confirmación de la contraseña es un campo solo de la web; no se envía, así que la API y el contrato no la conocen.

**Alternativas descartadas:** exigir mayúscula y símbolo (reglas de composición que no mejoran la entropía de forma útil); enviar la confirmación a la API (superficie sin beneficio).

### D3. Mayoría de edad y coincidencia entre CURP y RFC
- La fecha de nacimiento sale de la CURP (el carácter 17 indica el siglo: dígito antes de 2000, letra desde 2000). Debe existir, no estar en el futuro (`INVALID_DATE`) y corresponder a 18 años o más al día de hoy en `America/Mexico_City` (`DATE_OUT_OF_RANGE`). "Hoy" lo da el reloj de la API, nunca el del cliente.
- Quien nació un 29 de febrero cumple 18 el 1 de marzo en un año no bisiesto.
- Los primeros 10 caracteres del RFC deben ser iguales a los de la CURP; el error va en `/rfc` con `INVALID_FORMAT` y el mensaje "El RFC no coincide con tu CURP". Si el RFC ya es inválido por sí solo, no se repite el error.
- La coincidencia vive en el esquema del formulario de registro (CTR-13) y no en el validador del RFC, que no conoce otro campo; por eso CTR-11 mantiene que el validador solo no la exige.
- Al escribir se conservan `Ñ` y `&` en la CURP y el RFC, porque un RFC de persona física puede traerlas.
- Todos los códigos salen del enum `FieldErrorCode` existente; no se agrega uno.

**Alternativas descartadas:** validar la edad con la fecha del RFC (también la lleva, pero se prefiere la CURP, que ya tiene dígito verificador); reportar el error de coincidencia en `/curp` (el campo que el usuario debe revisar es el RFC).

### D4. Monto: saneamiento al escribir
El campo de monto descarta lo que no sea dígito o punto (también al pegar), deja a lo más 2 decimales y 12 dígitos enteros, colapsa los ceros a la izquierda (`007` pasa a `7`, `0.5` se conserva) y muestra comas de miles (`12,345.67`). A la API va el monto sin separadores (`12345.67`). El saneamiento es una función pura del contrato (CTR-20), idempotente sobre su propio resultado, que usan la web y la app; la validación sigue siendo CTR-08.

**Por qué.** El rechazo del tercer decimal ya existía al enviar; moverlo al teclear evita el error y mantiene el invariante de no redondear nunca. La web conserva la posición del cursor al insertar una coma.

**Alternativas descartadas:** `Intl.NumberFormat` con el valor numérico (convierte a punto flotante, prohibido por MOB-15 y WEB-21); `type="number"` (admite `e`, signos y cambia con la configuración regional).

### D5. Referencia nula en lugar de un valor por omisión
`reference` sale de `required` en `CreateTransferRequest`; en `Transfer` y `Movement` pasa a `string | null`. Sin referencia, la API guarda `NULL` (migración `1760800000000-optional-transfer-reference`, que también aplica a los asientos de la Tesorería) y la devuelve como `null`. Una referencia vacía equivale a omitirla, también para la huella de idempotencia. Los correos, el PDF y las pantallas ocultan la fila en lugar de imprimir "null" ni "0".

**Por qué.** Un valor por omisión (`0`, `0000000`) se confunde con una referencia real y obliga a todos los consumidores a conocer ese valor mágico. `null` dice lo que es.

**Alternativas descartadas:** `reference: "0"` por omisión (se imprime y se confunde); dejar el campo obligatorio y solo ocultarlo en la interfaz (la API seguiría pidiendo algo que nadie tiene).

### D6. Códigos de 6 dígitos
La web y la app solo admiten dígitos, máximo 6, también al pegar, con teclado numérico y `autocomplete="one-time-code"`. La API y el contrato ya exigían `^[0-9]{6}$`; este change solo agrega pruebas de que letras, 5 y 7 dígitos responden 422 sin consumir intentos.

### D7. Perfil de la barra lateral con menú
El bloque de perfil (avatar, nombre y correo) pasa a ser un solo botón de ancho completo con un chevron; nombre y correo se truncan en una línea con `min-w-0` y `truncate`. Abre un menú anclado encima (`role="menu"`, `aria-haspopup`, `aria-expanded`) con "Cerrar sesión". Se cierra con Escape, clic fuera y al elegir, devuelve el foco al botón y se recorre con las flechas. El cierre de sesión usa la acción existente (WEB-05).

**Alternativas descartadas:** dejar "Cerrar sesión" suelto debajo del perfil (dos controles para una persona, y un clic accidental cierra la sesión); usar un `<select>` (no admite el avatar ni el truncado).

### D8. Recibir: la CLABE completa solo ahí
"Recibir" es una acción rápida de Inicio, después de "Transferir", que abre una hoja con un selector de cuenta (con la de Inicio preseleccionada), Titular, Banco ("TreoWallet"), Cuenta y la CLABE completa en grupos de 4. "Copiar CLABE" copia los 18 dígitos sin espacios; la app móvil agrega "Compartir" con la hoja nativa. No requiere cambios en la API: el titular sale de la sesión y la CLABE de la lista de cuentas. Se quita "Mostrar CLABE" de las tarjetas, que solo muestran los últimos 4 dígitos; esa diferencia entre el lienzo y la app (R29) deja de existir.

**Por qué.** La CLABE completa es un dato que se comparte a propósito, no algo que deba estar a un toque en cada tarjeta. Una hoja con todos los datos de cobro responde a lo que la persona va a hacer con ella.

**Alternativas descartadas:** mantener el interruptor y agregar un botón de copiar (dos formas de ver la misma cosa); un endpoint de "datos de cobro" (los datos ya están en el cliente).

### D9. Búsqueda de beneficiarios en el cliente
Un campo de búsqueda arriba de la lista (en Beneficiarios, y en el paso de destinatario de la web y la app) filtra sin distinguir mayúsculas ni acentos por nombre y alias, y por contener los dígitos escritos en la CLABE cuando la consulta son solo dígitos. Las cuentas propias del paso de destinatario no se filtran. Sin coincidencias hay un estado vacío con "Limpiar búsqueda"; sin beneficiarios no se muestra el campo. La función de coincidencia es del contrato (CTR-20) para que ambas apps coincidan.

**Por qué.** `listBeneficiaries` no está paginada; un filtro en el servidor agregaría una ruta, un índice y latencia para una lista que ya está completa en el cliente. Si algún día se pagina, el filtro pasa al servidor y esta decisión se revisa.

### D10. Meses del estado de cuenta desde la apertura
Los meses que se pueden pedir van del mes de creación de la cuenta (`Account.createdAt`, mes de la Ciudad de México) al mes en curso. La API responde 422 `VALIDATION_FAILED` con el error en `/period` y el código `DATE_OUT_OF_RANGE` para un periodo anterior, sin auditar la descarga; la cuenta ajena sigue siendo 404 antes que cualquier validación del periodo. La web calcula las opciones con la misma regla (`statementMonths`) y, si la API aun así rechaza un mes, muestra un mensaje claro sin descargar.

**Por qué.** Las cuentas se crean al verificar el correo; ofrecer 12 meses a una cuenta de una semana genera PDFs vacíos que no dicen nada.

### D11. `scheduledFor` como instante con precisión de minuto
`scheduledFor` pasa de `date` a `date-time` (RFC 3339 con desfase) en la petición y en las respuestas. Reglas: minutos exactos (segundos y fracción en cero), al menos 10 minutos y como máximo 90 días después del momento de la petición. Un instante fuera de la ventana es `DATE_OUT_OF_RANGE`; uno mal formado, con segundos o inexistente, `INVALID_FORMAT`. La huella de idempotencia usa el instante en UTC, así que `...-06:00` y `...Z` equivalentes son la misma petición; para las inmediatas no cambia.

- **Base de datos:** migración `1760800001000-scheduled-for-instant` convierte `scheduled_for` a `timestamptz`; las filas existentes (que eran una fecha) quedan a las 09:00 de `America/Mexico_City`, porque 00:00 las habría hecho vencer de inmediato. `ck_transfers_scheduled_for_minute` impide guardar segundos. El `down` vuelve a `date` y pierde la hora.
- **Ejecutor:** reclama las filas con `scheduled_for <= now()` con el mismo `SKIP LOCKED`, así que la ejecución exactamente una vez no cambia; pasa a ocurrir en la primera pasada (cada 60 s por omisión) posterior al instante.
- **Correos y auditoría:** muestran fecha y hora de la Ciudad de México ("20 de octubre de 2026, 14:30").
- **Web:** `ScheduleField` pone una fecha y una hora (`type="time"`, paso de 60 s) lado a lado, ambas obligatorias con "Programar". Se combinan como hora de la Ciudad de México en un instante (`mexicoCityToInstant`). La app móvil no programa ni lista programadas; si algún día muestra `scheduledFor`, muestra fecha y hora.
- **Ventana:** se suma en milisegundos, no en días locales, así que no depende del horario de verano (que México ya no tiene).

**Esto sustituye** la decisión de `scheduled-transfers` de programar "solo con fecha" (estaba en sus *Non-Goals*).

**Alternativas descartadas:**
- Mantener la fecha y agregar un campo `scheduledTime` aparte: dos campos que deben viajar juntos y una huella más compleja.
- Hora local sin desfase: ambigua y dependiente de la zona del cliente.
- Precisión de segundos: sin beneficio para el usuario y obliga a un ejecutor más frecuente.
- Convertir las filas existentes a las 00:00: las haría vencer de inmediato al migrar.

### D12. Mailpit con volumen
El servicio de correo de desarrollo guarda su base en `/data/mailpit.db` sobre el volumen `mailpit-data`, para que los correos (códigos de verificación y de OTP, avisos) sobrevivan a `docker compose down` y a recrear el contenedor; solo `down -v` los borra.

**Alternativa descartada:** dejarla en memoria (se pierde el código con el que se estaba probando cada vez que se reinicia).

### D13. Versionado del contrato
Los cambios del contrato se publican como 1.3.0. Por CTR-02, endurecer una validación existente (nombre, contraseña, teléfono) y cambiar el tipo de `scheduledFor` son cambios incompatibles que pedirían 2.0.0. Se publica como versión menor porque los cuatro consumidores viven en este repositorio, se instalan por `file:` y se actualizan juntos en este mismo change, y no hay un cliente externo que se rompa. Cuando los repositorios se separen y el contrato se publique, un cambio así sí pedirá versión mayor.

### D14. CURP, RFC o teléfono de otra cuenta: respuesta uniforme (se revirtió el error por campo)
Se implementó primero un `422 VALIDATION_FAILED` con `ALREADY_REGISTERED` en cada campo que chocaba (tareas 2.4 a 2.6), para que el formulario dijera qué dato corregir. Se revirtió (tareas 2.7 a 2.9): con un email inventado, cualquiera podía preguntar si una CURP, un RFC o un teléfono ya tenían cuenta, y saber que una persona es cliente de una billetera es información sensible. El límite de 10 registros por hora por IP no lo impide: se esquiva cambiando de IP.

Vuelven IDN-01 e IDN-03 como los define `api-foundation`: el registro responde `202` en todos los casos, no crea al usuario y envía al email indicado el aviso genérico "No pudimos completar tu registro", sin decir qué dato chocó. `ALREADY_REGISTERED` sale de `FieldErrorCode`; como en D13, se publica sin versión mayor porque todos los consumidores viven en este repositorio.

**Alternativa descartada:** mantener el error por campo y encarecer la consulta con un CAPTCHA de AWS WAF en el registro. Encarece la enumeración, pero no la impide, y suma un acertijo al registro y el costo por intento.

## Risks / Trade-offs

- **Datos viejos que no cumplen las reglas nuevas.** Los usuarios ya registrados con un nombre de una palabra o una contraseña sin dígito siguen siendo válidos: las reglas solo aplican al registro. La mitigación es que ninguna otra ruta valida `PersonName` ni `Password`.
- **`down` con pérdida.** Revertir `1760800001000-scheduled-for-instant` conserva el día de la Ciudad de México y descarta la hora de las programadas pendientes. Está documentado en la migración y en el README.
- **Cambio de tipo en `scheduledFor`.** Un cliente que siga mandando `AAAA-MM-DD` recibe 422 `INVALID_FORMAT`. Sin clientes externos, el riesgo se limita a una instalación desactualizada de la web o la app.
- **Paridad web y móvil.** Cada pantalla común (Recibir, búsqueda, campos) se compone primero en el lienzo de ambas apps y luego en el código; las notas de design-sync registran lo que ya se aplicó.
- **Búsqueda en el cliente.** Con una lista muy grande el filtro sería lento; la lista está acotada hoy por los límites de altas (BEN-10) y se revisará si se pagina.
- **Registro que no se completa sin decir por qué (D14).** Quien escribe una CURP, un RFC o un teléfono de otra cuenta solo se entera por correo, sin saber qué dato corregir. Es el costo de que ningún dato de identidad pueda enumerarse.
