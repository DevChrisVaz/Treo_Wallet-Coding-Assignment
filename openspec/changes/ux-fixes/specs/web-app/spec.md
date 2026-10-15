## MODIFIED Requirements

### Requirement: WEB-11 Registro y verificación de correo
La web SHALL ofrecer un registro con email, contraseña, confirmación de la contraseña, nombre completo, CURP, RFC y teléfono, validados en el formulario con las reglas del contrato (CTR-13). Cada campo MUST validarse al salir de él, sin esperar al envío, y corregirse al teclear. La confirmación de la contraseña es un campo solo de la interfaz: MUST coincidir con la contraseña y MUST NOT enviarse a la API. Mientras se escribe, la CURP y el RFC MUST quedar en mayúsculas alfanuméricas con un máximo de 18 y 13 caracteres, y el teléfono en dígitos con un máximo de 10, también al pegar. El email MUST enviarse recortado y en minúsculas. Si la API acepta el registro (`202`), la web MUST mostrar siempre el mismo mensaje genérico y llevar al usuario a la verificación, donde captura el código de 6 dígitos y puede pedir un reenvío. Si la API responde `422` con errores de campo, incluido `ALREADY_REGISTERED` cuando la CURP, el RFC o el teléfono ya son de otra cuenta (IDN-03), la web MUST mostrar cada mensaje bajo su campo y quedarse en el formulario. Al verificar, la web SHALL iniciar la sesión con los tokens recibidos y mostrar el resumen de cuentas.

#### Scenario: Registro enviado
- **WHEN** el usuario envía un registro válido
- **THEN** la web muestra "Si los datos son correctos, recibirás un correo con las instrucciones." y la pantalla de verificación

#### Scenario: CURP con dígito verificador inválido
- **WHEN** el usuario escribe una CURP cuyo último dígito no corresponde al cálculo del verificador
- **THEN** el formulario marca el campo CURP como inválido y no envía la petición

#### Scenario: Validación al salir del campo
- **WHEN** el usuario escribe un nombre de una sola palabra y pasa al siguiente campo
- **THEN** el formulario marca el nombre como inválido sin haber enviado el registro

#### Scenario: Confirmación de contraseña distinta
- **WHEN** la confirmación de la contraseña no coincide con la contraseña y el usuario sale del campo
- **THEN** el formulario marca la confirmación como inválida
- **AND** la petición de registro nunca lleva ese campo

#### Scenario: RFC que no coincide con la CURP
- **WHEN** los primeros 10 caracteres del RFC difieren de los de la CURP
- **THEN** el formulario marca el RFC con "El RFC no coincide con tu CURP"

#### Scenario: Campos restringidos al escribir
- **WHEN** el usuario escribe o pega `"gomc-900101 hdf"` en la CURP y `"55 1234-5678 x"` en el teléfono
- **THEN** la CURP queda `"GOMC900101HDF"` y el teléfono `"5512345678"`

#### Scenario: Email con mayúsculas y espacios
- **WHEN** el usuario escribe `" Ana@Example.COM "`
- **THEN** la petición lleva `"ana@example.com"`

#### Scenario: Error del servidor en un campo
- **WHEN** la API responde 422 con un error en `/curp` o `/rfc`
- **THEN** la web lo muestra bajo ese campo

#### Scenario: Datos de otra cuenta
- **WHEN** la API responde 422 con `ALREADY_REGISTERED` en `/curp` y en `/phone`
- **THEN** la web muestra "Esta CURP ya está registrada en otra cuenta." bajo la CURP y "Este teléfono ya está registrado en otra cuenta." bajo el teléfono
- **AND** el foco va a la CURP y la web no pasa a la verificación

#### Scenario: Código incorrecto
- **WHEN** el usuario envía un código incorrecto y la API responde `VERIFICATION_CODE_INVALID` con `attemptsRemaining` 2
- **THEN** la web muestra "El código no es correcto o ya venció. Te quedan 2 intentos." (mensaje de `VERIFICATION_CODE_INVALID` del paquete de diseño más los intentos)

#### Scenario: Verificación exitosa
- **WHEN** el usuario envía el código correcto
- **THEN** la web crea la sesión y muestra el resumen con las cuentas "Principal" y "Ahorro" en $0.00

### Requirement: WEB-13 Resumen de cuentas
La web SHALL mostrar las cuentas del usuario con su nombre, su CLABE enmascarada (solo los últimos 4 dígitos) y su saldo, y el límite diario de transferencias con lo usado y lo restante del día ("Te quedan $X hoy"). La CLABE completa MUST mostrarse únicamente en "Recibir dinero" (WEB-35); la tarjeta de cuenta MUST NOT ofrecer mostrarla.

#### Scenario: Cuentas con saldo
- **WHEN** el usuario abre el resumen y la API devuelve "Principal" con `"25000.00"` y "Ahorro" con `"10000.00"`
- **THEN** la web muestra "$25,000.00" y "$10,000.00"

#### Scenario: CLABE enmascarada
- **WHEN** el resumen muestra una cuenta con CLABE terminada en 1234
- **THEN** la tarjeta muestra "•••• 1234" y no ofrece "Mostrar CLABE"

#### Scenario: Límite restante
- **WHEN** `dailyLimit.remaining` es `"38000.00"`
- **THEN** la web muestra "Te quedan $38,000.00 hoy"

#### Scenario: El límite se reinicia a medianoche de Ciudad de México
- **WHEN** el usuario consultó el resumen a las 23:59 con `remaining` en `"0.00"`
- **AND** vuelve a consultarlo a las 00:01 hora de Ciudad de México
- **THEN** la web muestra el límite restante completo que devuelve la API, sin calcularlo en el navegador

### Requirement: WEB-16 Flujo de transferencia
La web SHALL guiar la transferencia en pasos: formulario (cuenta origen, destino propio o beneficiario, monto, concepto y referencia opcional), confirmación con el resumen, código OTP cuando la transferencia quede `PENDING_OTP` y comprobante final. Como destino propio MUST ofrecer solo cuentas del usuario distintas de la cuenta origen. La referencia MUST llamarse "Referencia (opcional)", admitir solo dígitos con un máximo de 7 (también al pegar) y usar teclado numérico; si queda vacía, MUST omitirse de la petición. El resumen MUST decir "Sin referencia" cuando no hay, y el comprobante MUST mostrar estado, monto, origen, destino, concepto, fecha y el identificador de la transferencia, y la referencia solo si existe.

#### Scenario: Transferencia sin OTP
- **WHEN** el usuario confirma una transferencia de `"5000.00"` a un beneficiario
- **AND** la API responde `201` con estado `COMPLETED`
- **THEN** la web muestra el comprobante y vuelve a consultar las cuentas y el historial

#### Scenario: Transferencia que requiere OTP
- **WHEN** el usuario confirma una transferencia de `"15000.00"`
- **AND** la API responde `201` con estado `PENDING_OTP`
- **THEN** la web pide el código enviado por correo e indica el destino enmascarado y la hora de expiración

#### Scenario: Transferencia a la propia cuenta
- **WHEN** el usuario elige "Principal" como origen
- **THEN** la lista de destinos propios no incluye "Principal"
- **AND** si la API responde `SAME_ACCOUNT_TRANSFER`, la web muestra "Elige una cuenta de destino distinta a la de origen." (mensaje de `SAME_ACCOUNT_TRANSFER` del paquete de diseño)

#### Scenario: Saldo insuficiente
- **WHEN** la API responde `422` con `code` `INSUFFICIENT_FUNDS`
- **THEN** la web muestra la alerta "Saldo insuficiente" con el mensaje "No tienes saldo suficiente para esta transferencia." (mensaje de `INSUFFICIENT_FUNDS` del paquete de diseño) junto al saldo disponible de la cuenta origen
- **AND** permite corregir el monto, lo que inicia un intento nuevo

#### Scenario: Referencia solo con dígitos
- **WHEN** el usuario escribe o pega `"12a-34567890"` en la referencia
- **THEN** el campo queda en `"1234567"`

#### Scenario: Sin referencia
- **WHEN** el usuario deja la referencia vacía y envía la transferencia
- **THEN** la petición no lleva `reference`, el resumen dice "Sin referencia" y el comprobante no muestra la fila de referencia

### Requirement: WEB-18 Confirmación con OTP
La web SHALL permitir capturar el código de 6 dígitos, mostrar los intentos restantes tras un código incorrecto, reenviar el código mientras queden reenvíos y avisar cuando la transferencia expiró o falló. El campo del código MUST admitir solo dígitos con un máximo de 6, también al pegar, usar teclado numérico y `autocomplete="one-time-code"`; lo demás no puede escribirse. Si el envío del correo falló (`deliveryStatus` `FAILED`), MUST ofrecer reenviar el código. El botón de confirmar MUST deshabilitarse mientras se envía.

#### Scenario: Código incorrecto
- **WHEN** la API responde `OTP_INVALID` con `attemptsRemaining` 1
- **THEN** la web muestra "El código no es correcto. Te queda 1 intento." (mensaje de `OTP_INVALID` del paquete de diseño más los intentos)

#### Scenario: Intentos agotados
- **WHEN** la API responde `OTP_ATTEMPTS_EXHAUSTED`
- **THEN** la web muestra que la transferencia no se realizó y ofrece iniciar una nueva

#### Scenario: Transferencia expirada
- **WHEN** la API responde `409` con `code` `TRANSFER_EXPIRED`
- **THEN** la web muestra "El código venció. Crea la transferencia de nuevo." (mensaje de `TRANSFER_EXPIRED` del paquete de diseño)

#### Scenario: Doble clic en "Confirmar"
- **WHEN** el usuario hace doble clic en "Confirmar"
- **THEN** la web envía una sola confirmación

#### Scenario: Revalidación fallida al confirmar
- **WHEN** la API responde `DAILY_LIMIT_EXCEEDED` al confirmar
- **THEN** la web muestra la alerta "Superaste tu límite diario" con el mensaje de `DAILY_LIMIT_EXCEEDED` del paquete de diseño y el monto restante del día

#### Scenario: Código con letras o más de 6 dígitos
- **WHEN** el usuario escribe o pega `"12ab3456789"` en el campo del código
- **THEN** el campo queda en `"123456"`

### Requirement: WEB-21 Montos sin floats ni redondeo
La web SHALL mostrar todos los montos con el formato de moneda `es-MX` en MXN a partir del string decimal de la API, sin convertirlos a números de punto flotante. Los montos capturados MUST validarse con las reglas del contrato y enviarse como string; un monto con más de 2 decimales MUST rechazarse en el formulario, nunca redondearse. Mientras se escribe o se pega, el campo de monto MUST admitir solo dígitos y un punto con un máximo de 2 decimales, mostrarse con separadores de miles (`12,345.67`) y enviarse sin ellos (`12345.67`).

#### Scenario: Formato de un monto
- **WHEN** la API devuelve un saldo `"1250.50"`
- **THEN** la web muestra "$1,250.50"

#### Scenario: Monto con tres decimales
- **WHEN** el usuario escribe `100.005` como monto
- **THEN** el campo conserva `100.00` y no admite el tercer decimal

#### Scenario: Letras y símbolos
- **WHEN** el usuario escribe o pega `"12a,345.678 MXN"` en el monto
- **THEN** el campo muestra `12,345.67` y la petición lleva `"12345.67"`

#### Scenario: Cursor al dar formato
- **WHEN** el usuario teclea un dígito que hace aparecer una coma de miles en medio del número
- **THEN** el cursor se queda junto al mismo dígito

### Requirement: WEB-26 Navegación del dashboard
En la forma de *dashboard*, la web SHALL mostrar una navegación lateral con el Wordmark, los destinos Inicio, Movimientos, Transferir y Beneficiarios con su icono, y abajo el perfil del usuario; y una barra superior con el título de la página y "Nueva transferencia" como acción principal. El perfil MUST ser un solo botón de ancho completo con avatar, nombre y correo (cada uno en una línea, truncados con puntos suspensivos sin desbordar) y un chevron, con `aria-haspopup="menu"` y `aria-expanded`. Al activarlo MUST abrir, encima del botón, un menú (`role="menu"`) con "Cerrar sesión"; el menú MUST cerrarse con Escape, con un clic fuera y al elegir una opción, devolver el foco al botón y poder recorrerse con las flechas. No debe haber un control de "Cerrar sesión" aparte del menú. El destino actual MUST marcarse con `aria-current="page"`. Sustituye la navegación de encabezado vigente.

#### Scenario: Destino actual
- **WHEN** el usuario está en Movimientos en escritorio
- **THEN** el destino Movimientos de la navegación lateral tiene `aria-current="page"` y el estilo de destino actual

#### Scenario: Perfil como un solo botón
- **WHEN** se muestra la navegación lateral en escritorio
- **THEN** el perfil es un único botón con menú y no hay un botón "Cerrar sesión" suelto
- **AND** "Cerrar sesión" no se ve hasta abrir el menú

#### Scenario: Nombre y correo largos
- **WHEN** el nombre y el correo del usuario no caben en el ancho del botón
- **THEN** cada uno ocupa una línea y se corta con puntos suspensivos sin desbordar el botón

#### Scenario: Cerrar el menú
- **WHEN** el menú del perfil está abierto y el usuario pulsa Escape o hace clic fuera
- **THEN** el menú se cierra y el foco vuelve al botón del perfil

#### Scenario: Cerrar sesión desde el menú
- **WHEN** el usuario elige "Cerrar sesión" en el menú del perfil
- **THEN** se cierra la sesión como indica WEB-05

### Requirement: WEB-28 Inicio rediseñado
Inicio SHALL mostrar un *hero* con el saldo total de las cuentas, lo que queda del límite diario y acciones rápidas (al menos Transferir, Recibir y Ver movimientos, en ese orden); las cuentas como tarjetas seleccionables con la CLABE enmascarada; el medidor del límite diario; y los últimos 5 movimientos de la cuenta seleccionada con "Ver todos", que abre Movimientos con esa cuenta. "Recibir" MUST abrir "Recibir dinero" (WEB-35). Amplía WEB-13.

#### Scenario: Saldo total
- **WHEN** el usuario tiene Principal con $25,000.00 y Ahorro con $10,000.00
- **THEN** el *hero* muestra $35,000.00 sumado sin punto flotante

#### Scenario: Cambiar de cuenta
- **WHEN** el usuario selecciona la tarjeta de Ahorro
- **THEN** la tarjeta queda marcada como seleccionada y la lista muestra los últimos 5 movimientos de Ahorro

#### Scenario: Acción Recibir
- **WHEN** el usuario abre Inicio
- **THEN** las acciones rápidas muestran "Recibir" después de "Transferir"

### Requirement: WEB-32 Descarga del estado de cuenta
La pantalla de movimientos de una cuenta SHALL ofrecer:
- un selector de mes que va del mes de apertura de la cuenta (`Account.createdAt`, en `America/Mexico_City`) al mes en curso, marcado "(en curso)", del más reciente al más antiguo, con el mes anterior seleccionado por defecto (o el mes en curso si es el único);
- un botón "Descargar PDF" que descarga el estado de cuenta de la cuenta y el mes elegidos.

La descarga MUST pasar por el proxy de lecturas del BFF. Su lista blanca SHALL incluir la ruta del estado de cuenta, solo con GET, y el proxy MUST entregar intactos los bytes del PDF junto con `Content-Type` y `Content-Disposition`. Los tokens MUST NOT llegar al navegador (WEB-01).

Mientras se descarga, el botón MUST mostrar que está ocupado y no aceptar otro clic. Si la descarga falla, la pantalla MUST mostrar el mensaje del código de error sin salir de ella; en `RATE_LIMITED`, el mensaje incluye la espera; si la API rechaza el mes por ser anterior a la apertura de la cuenta (`DATE_OUT_OF_RANGE` en `/period`), el mensaje lo dice y no se descarga nada. Amplía WEB-09 y WEB-14.

#### Scenario: Descargar un mes cerrado
- **WHEN** Ana elige "septiembre 2026" en la pantalla de movimientos de "Principal" y pulsa "Descargar PDF"
- **THEN** el BFF pide `getAccountStatement` con el periodo `2026-09`
- **AND** el navegador recibe un `application/pdf` con el nombre `estado-de-cuenta-2026-09-0015.pdf`

#### Scenario: Opciones del selector
- **WHEN** Ana, con una cuenta abierta en agosto de 2026, abre la pantalla de movimientos el 14 de octubre de 2026
- **THEN** el selector ofrece "octubre 2026 (en curso)", "septiembre 2026" y "agosto 2026", en ese orden
- **AND** "septiembre 2026" está seleccionado

#### Scenario: Cuenta de hace más de un año
- **WHEN** la cuenta se abrió en agosto de 2025 y hoy es el 14 de octubre de 2026
- **THEN** el selector ofrece todos los meses de agosto de 2025 a octubre de 2026

#### Scenario: Cuenta abierta este mes
- **WHEN** la cuenta se abrió en octubre de 2026 y hoy es el 14 de octubre de 2026
- **THEN** el selector ofrece solo "octubre 2026 (en curso)", seleccionado

#### Scenario: Mes de apertura de noche
- **WHEN** la cuenta se abrió a las 23:30 del 30 de septiembre de 2026 en la Ciudad de México (05:30 UTC del 1 de octubre)
- **THEN** su primer mes del selector es septiembre de 2026

#### Scenario: Mes anterior a la apertura
- **WHEN** la API responde 422 con `DATE_OUT_OF_RANGE` en `/period`
- **THEN** la pantalla muestra "Ese mes es anterior a la apertura de tu cuenta. Elige un mes más reciente." y no descarga nada

#### Scenario: Doble clic en Descargar
- **WHEN** Ana hace doble clic en "Descargar PDF"
- **THEN** el BFF recibe una sola petición del estado de cuenta

#### Scenario: Demasiadas descargas
- **WHEN** la API responde 429 `RATE_LIMITED` con `Retry-After: 60`
- **THEN** la pantalla muestra el mensaje de `RATE_LIMITED` con la espera y sigue mostrando los movimientos

#### Scenario: Bytes intactos
- **WHEN** el proxy entrega un estado de cuenta
- **THEN** los bytes que recibe el navegador son idénticos a los que respondió la API

#### Scenario: Ruta binaria fuera de la lista blanca
- **WHEN** el navegador pide por GET `accounts/<id>/statements/2026-09/extra`
- **THEN** la web responde `404` y la API no recibe ninguna llamada

### Requirement: WEB-33 Programar una transferencia
El flujo de transferencia SHALL ofrecer la opción "Cuándo", con dos valores: "Ahora", seleccionado por defecto, y "Programar". "Programar" muestra un campo de fecha y un campo de hora (en minutos) lado a lado, ambos obligatorios, en hora de la Ciudad de México; el campo de fecha se limita a las fechas que contienen la ventana programable (de 10 minutos a 90 días después de ahora). El formulario MUST combinar fecha y hora en el instante que espera `scheduledFor` y validarlo con el esquema del contrato antes de enviar: sin fecha pide la fecha, sin hora pide la hora y un momento fuera de la ventana se marca con el mensaje del contrato.

En cada paso del flujo:
- **Revisión:** MUST mostrar "Se enviará el <fecha y hora>" en palabras (por ejemplo, "20 de octubre de 2026, 14:30").
- **Envío:** MUST mandar `scheduledFor` con la misma llave de idempotencia por intento (WEB-17).
- **Resultado `SCHEDULED`:** MUST mostrar "Transferencia programada" con la fecha y la hora y un enlace a la página de programadas.
- **Monto mayor a 10000.00:** el paso del código (WEB-18) MUST aparecer igual que en una inmediata y terminar en el resultado programado.
- **Errores** `DATE_OUT_OF_RANGE`, `SCHEDULED_LIMIT_REACHED` y `TOO_LARGE`: MUST mostrarse con el texto del paquete de diseño, junto al campo cuando el error es de un campo.

Amplía WEB-16, WEB-17 y WEB-18.

#### Scenario: Programar una transferencia
- **WHEN** Ana elige "Programar", la fecha 20 de octubre de 2026, la hora 14:30 y 1000.00 a Luis, revisa y envía
- **THEN** la revisión dice "Se enviará el 20 de octubre de 2026, 14:30"
- **AND** la petición lleva `scheduledFor` `2026-10-20T20:30:00.000Z`
- **AND** el resultado dice "Transferencia programada" con la insignia "Programada"

#### Scenario: Rango del campo de fecha
- **WHEN** Ana elige "Programar" el 14 de octubre de 2026 a las 12:00
- **THEN** el campo de fecha admite del 14 de octubre de 2026 al 12 de enero de 2027

#### Scenario: Muy pronto
- **WHEN** Ana elige hoy a las 12:05 un momento a menos de 10 minutos de ahora (12:00)
- **THEN** el formulario marca el campo con el mensaje del contrato y no envía la petición

#### Scenario: Falta la hora
- **WHEN** Ana elige "Programar", escribe la fecha y deja la hora vacía
- **THEN** el formulario pide la hora, no marca la fecha y no envía la petición

#### Scenario: Programada mayor al umbral
- **WHEN** Ana programa 15000.00, confirma el código correcto
- **THEN** el resultado muestra "Transferencia programada" y no "Transferencia enviada"

#### Scenario: Doble clic al programar
- **WHEN** Ana hace doble clic en Enviar al programar
- **THEN** la API recibe la misma llave de idempotencia en ambas peticiones y existe una sola programada

#### Scenario: Tope alcanzado
- **WHEN** la API responde 422 `SCHEDULED_LIMIT_REACHED`
- **THEN** la pantalla muestra "Llegaste al máximo de 20 transferencias programadas. Cancela alguna para programar otra."

### Requirement: WEB-34 Página de transferencias programadas
La web SHALL ofrecer en su navegación una página "Programadas" con las transferencias de `listScheduledTransfers`, mediante el proxy de lecturas (la lista blanca agrega `transfers/scheduled`). Cada transferencia muestra la fecha y la hora programadas (en hora de la Ciudad de México), el destino con los últimos 4 dígitos de su CLABE, el monto y el concepto. Sin programadas, la página MUST mostrar el estado vacío "No tienes transferencias programadas".

Cada transferencia ofrece "Cancelar", que funciona así:
- pide confirmación en un diálogo accesible con el monto, el destino y la fecha y hora;
- ejecuta `cancelTransfer` mediante una Server Action (WEB-06 a WEB-08);
- si la cancelación funciona, la transferencia desaparece de la lista y se anuncia "Transferencia cancelada";
- si la API responde 409 `TRANSFER_NOT_CANCELLABLE`, MUST mostrarse su mensaje y la lista MUST volver a cargarse.

El comprobante de una transferencia (WEB-16) MUST mostrar la fecha y la hora programadas cuando existan, y la insignia de `SCHEDULED` o `CANCELLED`.

#### Scenario: Lista de programadas
- **WHEN** Ana abre "Programadas" con dos transferencias en `SCHEDULED`
- **THEN** la página las muestra en el orden de la API con su fecha y hora, destino, monto y concepto

#### Scenario: Cancelar con confirmación
- **WHEN** Ana pulsa "Cancelar" en una programada y confirma en el diálogo
- **THEN** la web llama a `cancelTransfer` una sola vez y la transferencia desaparece de la lista
- **AND** se anuncia "Transferencia cancelada"

#### Scenario: Desistir de cancelar
- **WHEN** Ana pulsa "Cancelar" y cierra el diálogo con "Volver" o con Escape
- **THEN** la web no llama a `cancelTransfer` y el foco vuelve al botón "Cancelar"

#### Scenario: Ya se ejecutó
- **WHEN** Ana confirma la cancelación de una programada que el proceso acaba de ejecutar
- **THEN** la página muestra "Esta transferencia ya no se puede cancelar." y la lista ya no la incluye

#### Scenario: Sin programadas
- **WHEN** Ana no tiene transferencias programadas
- **THEN** la página muestra "No tienes transferencias programadas"

#### Scenario: Comprobante de una programada
- **WHEN** Ana abre el comprobante de una transferencia programada para las 14:30 del 20 de octubre de 2026
- **THEN** el comprobante muestra "Programada para" con "20 de octubre de 2026, 14:30" y la insignia de su estado

## ADDED Requirements

### Requirement: WEB-35 Recibir dinero
Inicio SHALL ofrecer la acción rápida "Recibir" (con una flecha entrante), después de "Transferir", que abre la hoja "Recibir dinero" (hoja en teléfono y panel centrado en el *dashboard*). La hoja MUST ofrecer arriba un selector de las cuentas del usuario, con la cuenta elegida en Inicio preseleccionada, y MUST mostrar los datos de la cuenta elegida: "Titular" (el nombre completo de la sesión; sin sesión, la fila se omite), "Banco" ("TreoWallet"), "Cuenta" (el nombre de la cuenta) y "CLABE" completa en grupos de 4 dígitos. "Copiar CLABE" MUST copiar los 18 dígitos sin espacios y mostrar "CLABE copiada", anunciado a los lectores de pantalla, antes de volver a "Copiar CLABE" unos segundos después; si el portapapeles falla, MUST avisarlo y dejar la CLABE a la vista. La hoja MUST incluir la indicación "Comparte estos datos para que te transfieran desde otra cuenta TreoWallet.", cerrarse con Escape y, al reabrirla, volver a la cuenta de Inicio. Esta es la única pantalla de la web que muestra la CLABE completa.

#### Scenario: Abrir Recibir
- **WHEN** el usuario está en Inicio con "Ahorro" seleccionada y pulsa "Recibir"
- **THEN** se abre "Recibir dinero" con "Ahorro" preseleccionada
- **AND** muestra Titular, Banco "TreoWallet", Cuenta "Ahorro" y la CLABE en grupos de 4 dígitos

#### Scenario: Cambiar de cuenta
- **WHEN** el usuario elige "Principal" en el selector, con el ratón o con las flechas
- **THEN** la hoja muestra la cuenta y la CLABE de "Principal"

#### Scenario: Copiar la CLABE
- **WHEN** el usuario pulsa "Copiar CLABE"
- **THEN** el portapapeles recibe los 18 dígitos sin espacios y el botón dice "CLABE copiada"
- **AND** unos segundos después vuelve a decir "Copiar CLABE"

#### Scenario: Portapapeles no disponible
- **WHEN** el portapapeles falla al copiar
- **THEN** la hoja avisa que no se pudo copiar y la CLABE sigue a la vista

#### Scenario: Cerrar con Escape
- **WHEN** el usuario cambia a "Principal" y pulsa Escape
- **THEN** la hoja se cierra y, al reabrirla, vuelve a la cuenta de Inicio

### Requirement: WEB-36 Búsqueda de beneficiarios
La página de Beneficiarios y el paso de destinatario del flujo de transferencia SHALL ofrecer, arriba de la lista de beneficiarios, un campo de búsqueda (`type="search"`) con una lupa al inicio, el texto de ayuda "Buscar por nombre, alias o CLABE" y un botón × que lo vacía cuando tiene texto; Escape también lo vacía. El filtro MUST hacerse en el cliente, porque la lista no está paginada: sin distinguir mayúsculas ni acentos por nombre y alias, y por contener los dígitos escritos en la CLABE cuando la consulta son solo dígitos. En el paso de destinatario, las cuentas propias MUST NOT filtrarse. Sin coincidencias, la web MUST mostrar el estado vacío "Sin resultados" con "No hay beneficiarios que coincidan con «<consulta>»." y la acción "Limpiar búsqueda", que vacía el campo y devuelve la lista. Sin beneficiarios, el campo MUST NOT mostrarse.

#### Scenario: Filtrar por nombre sin acentos
- **WHEN** la usuaria tiene a "José Núñez" y a "Luis Pérez" y escribe `"nunez"`
- **THEN** la lista muestra solo a "José Núñez"

#### Scenario: Filtrar por CLABE
- **WHEN** el usuario escribe dígitos que están dentro de la CLABE de un beneficiario
- **THEN** la lista muestra solo a los beneficiarios cuya CLABE los contiene

#### Scenario: Sin coincidencias
- **WHEN** el usuario escribe `"zzz"`
- **THEN** la web muestra "Sin resultados" y "Limpiar búsqueda"
- **AND** al pulsar "Limpiar búsqueda" el campo queda vacío y la lista vuelve a mostrar a todos

#### Scenario: Cuentas propias en el flujo de transferencia
- **WHEN** el usuario busca `"zzz"` en el paso de destinatario
- **THEN** las cuentas propias siguen a la vista y los beneficiarios muestran "Sin resultados"

#### Scenario: Sin beneficiarios
- **WHEN** el usuario no tiene beneficiarios
- **THEN** no se muestra el campo de búsqueda
