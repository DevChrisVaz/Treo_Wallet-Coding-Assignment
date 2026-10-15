# web-app Specification

## Purpose

Panel web de la billetera que actúa como intermediario (BFF) entre el navegador y la API: guarda la sesión en el servidor para que los tokens nunca lleguen al navegador y ofrece las pantallas de registro, cuentas, historial, beneficiarios y transferencias con estados claros y sin errores de saldo.

## Requirements

### Requirement: WEB-01 Los tokens nunca llegan al navegador
La web SHALL guardar el access token y el refresh token exclusivamente en el servidor, asociados a una sesión identificada por un valor opaco y aleatorio. Ninguna respuesta enviada al navegador (HTML, JSON, headers ni cookies) MUST contener un access token o un refresh token.

#### Scenario: Inicio de sesión exitoso
- **WHEN** el usuario inicia sesión con credenciales válidas
- **THEN** el navegador recibe una cookie de sesión cuyo valor es un identificador opaco
- **AND** ninguna respuesta recibida por el navegador contiene el access token ni el refresh token

#### Scenario: Las lecturas usan el Bearer del lado del servidor
- **WHEN** el navegador solicita sus cuentas a través de la web
- **THEN** la petición a la API lleva el header `Authorization: Bearer` agregado por el servidor de la web
- **AND** la respuesta al navegador no incluye el token

### Requirement: WEB-02 Atributos de la cookie de sesión
La cookie de sesión SHALL ser `HttpOnly`, `SameSite=Strict` y `Path=/`. Cuando la web se sirve por HTTPS, la cookie MUST ser además `Secure` y usar el prefijo `__Host-`. En desarrollo sobre `http://localhost` la web SHALL omitir `Secure` y el prefijo para que la sesión funcione en todos los navegadores.

#### Scenario: Cookie en producción
- **WHEN** la web corre con HTTPS y el usuario inicia sesión
- **THEN** la cookie se llama con el prefijo `__Host-` y tiene los atributos `HttpOnly`, `Secure`, `SameSite=Strict` y `Path=/`

#### Scenario: Cookie en desarrollo local
- **WHEN** la web corre en `http://localhost` y el usuario inicia sesión
- **THEN** la cookie tiene `HttpOnly`, `SameSite=Strict` y `Path=/`, sin `Secure` ni prefijo `__Host-`

### Requirement: WEB-03 Expiración por inactividad
La sesión web SHALL expirar tras 15 minutos sin peticiones del usuario. Cada petición autenticada MUST renovar el plazo de inactividad. La sesión MUST expirar también cuando la familia del refresh token alcance su vigencia absoluta.

#### Scenario: Sesión inactiva
- **WHEN** pasan más de 15 minutos desde la última petición del usuario
- **AND** el usuario intenta ver sus cuentas
- **THEN** la web descarta la sesión, borra la cookie y lleva al usuario al inicio de sesión con el mensaje "Tu sesión expiró"

#### Scenario: Actividad dentro del plazo
- **WHEN** el usuario hace una petición a los 14 minutos de la anterior
- **THEN** la sesión sigue activa y el plazo de inactividad vuelve a contar desde ese momento

### Requirement: WEB-04 Renovación única del access token
Cuando el access token esté vencido o por vencer, la web SHALL renovarlo con el refresh token antes de llamar a la API. Si varias peticiones de la misma sesión necesitan renovarlo al mismo tiempo, la web MUST hacer una sola renovación y todas MUST usar su resultado. Si la API responde `SESSION_REVOKED`, la web SHALL cerrar la sesión local y llevar al usuario al inicio de sesión.

#### Scenario: Peticiones simultáneas con el token vencido
- **WHEN** tres peticiones de la misma sesión llegan con el access token vencido
- **THEN** la web llama a `refreshSession` una sola vez
- **AND** las tres peticiones se completan con el access token nuevo

#### Scenario: Refresh revocado
- **WHEN** la API responde `401` con `code` `SESSION_REVOKED` al renovar
- **THEN** la web elimina la sesión, borra la cookie y muestra el inicio de sesión con el mensaje "Tu sesión expiró"

### Requirement: WEB-05 Cierre de sesión
Al cerrar sesión, la web SHALL pedir a la API que revoque la familia del refresh token, eliminar la sesión del servidor y borrar la cookie. El cierre de sesión MUST completarse localmente aunque la API no responda.

#### Scenario: Cierre de sesión normal
- **WHEN** el usuario pulsa "Cerrar sesión"
- **THEN** la web llama a `logout` con el refresh token de la sesión
- **AND** la sesión deja de existir en el servidor y la cookie se borra
- **AND** el usuario ve la pantalla de inicio de sesión

#### Scenario: La API no responde al cerrar sesión
- **WHEN** la llamada a `logout` falla por red
- **THEN** la web elimina igualmente la sesión y la cookie

### Requirement: WEB-06 Protección de las mutaciones contra CSRF
Toda operación que modifique estado SHALL ejecutarse en el servidor de la web solo si el origen de la petición coincide con el origen de la web o con un origen explícitamente permitido en la configuración. Las peticiones de otro origen MUST rechazarse sin llamar a la API.

#### Scenario: Mutación desde otro sitio
- **WHEN** una página de otro origen intenta crear una transferencia usando la cookie del usuario
- **THEN** la web rechaza la petición
- **AND** la API no recibe ninguna llamada

#### Scenario: Mutación detrás de un proxy permitido
- **WHEN** la web corre detrás de un proxy cuyo origen está en la lista de orígenes permitidos
- **AND** el usuario crea un beneficiario
- **THEN** la operación se ejecuta normalmente

### Requirement: WEB-07 Validación y autorización en cada mutación
Cada mutación SHALL validar su entrada en el servidor con las mismas reglas que el formulario del navegador, tomadas del contrato, y MUST verificar que exista una sesión activa antes de llamar a la API. Una entrada inválida MUST devolverse como `VALIDATION_FAILED` con los campos afectados, sin llamar a la API.

#### Scenario: Entrada inválida que evitó el formulario
- **WHEN** llega al servidor una creación de transferencia con monto `"100.005"`
- **THEN** la web responde un problema `VALIDATION_FAILED` con el campo `/amount`
- **AND** la API no recibe ninguna llamada

#### Scenario: Mutación sin sesión
- **WHEN** llega una creación de beneficiario sin cookie de sesión válida
- **THEN** la web responde un problema `UNAUTHENTICATED`
- **AND** la API no recibe ninguna llamada

### Requirement: WEB-08 Resultado de las mutaciones como valor
Cada mutación SHALL devolver al navegador un resultado exitoso con sus datos o un problema con el `code`, `title`, `detail` y extensiones que respondió la API. Los errores inesperados MUST llegar al navegador como `INTERNAL_ERROR` con el `requestId`, sin mensajes internos, trazas ni datos de la sesión.

#### Scenario: Rechazo de negocio
- **WHEN** la API responde `422` con `code` `INSUFFICIENT_FUNDS` y un `transferId`
- **THEN** el navegador recibe un problema con `code` `INSUFFICIENT_FUNDS` y el mismo `transferId`

#### Scenario: Error inesperado en el servidor de la web
- **WHEN** ocurre una excepción no prevista al procesar una mutación
- **THEN** el navegador recibe un problema `INTERNAL_ERROR` con un `requestId`
- **AND** el problema no contiene el mensaje de la excepción ni su traza

### Requirement: WEB-09 Proxy de lecturas con lista blanca
La web SHALL exponer las lecturas de la API únicamente mediante peticiones GET a rutas de una lista blanca (sesión, cuentas, detalle de cuenta, movimientos, beneficiarios y detalle de transferencia). El host de destino MUST ser el configurado para la API y nunca uno derivado de la petición. Cualquier otra ruta o método MUST responder `404` sin llamar a la API.

#### Scenario: Ruta permitida
- **WHEN** el navegador pide por GET los movimientos de una de sus cuentas
- **THEN** la web reenvía la petición a `listAccountMovements` con sus parámetros de consulta y devuelve la respuesta

#### Scenario: Ruta fuera de la lista blanca
- **WHEN** el navegador pide por GET una ruta que no está en la lista blanca
- **THEN** la web responde `404`
- **AND** la API no recibe ninguna llamada

#### Scenario: Método distinto de GET
- **WHEN** el navegador envía un POST a la ruta del proxy de lecturas
- **THEN** la web responde `404` o `405` sin llamar a la API

### Requirement: WEB-10 Propagación de headers hacia la API
En cada llamada a la API, la web SHALL enviar la IP del cliente en `X-Forwarded-For` y un `X-Request-Id`, reutilizando el que trae la petición del navegador o generando uno nuevo. En la creación de transferencias, la web MUST reenviar sin cambios la `Idempotency-Key` recibida del navegador y MUST NOT generarla ni reintentar la llamada por su cuenta.

#### Scenario: IP del cliente
- **WHEN** un usuario con IP `203.0.113.7` inicia sesión
- **THEN** la llamada a `login` lleva `X-Forwarded-For` con `203.0.113.7`

#### Scenario: Llave de idempotencia
- **WHEN** el navegador envía una creación de transferencia con la llave `K`
- **THEN** la llamada a `createTransfer` lleva `Idempotency-Key: K`
- **AND** la web hace exactamente una llamada a la API por esa petición

### Requirement: WEB-11 Registro y verificación de correo
La web SHALL ofrecer un registro con email, contraseña, confirmación de la contraseña, nombres, apellido paterno, apellido materno (opcional), fecha de nacimiento, entidad de nacimiento, CURP, RFC y teléfono, validados en el formulario con las reglas del contrato (CTR-13). Cada campo MUST validarse al salir de él, sin esperar al envío, y corregirse al teclear. La confirmación de la contraseña es un campo solo de la interfaz: MUST coincidir con la contraseña y MUST NOT enviarse a la API. Mientras se escribe, la CURP y el RFC MUST quedar en mayúsculas alfanuméricas con un máximo de 18 y 13 caracteres, y el teléfono en dígitos con un máximo de 10, también al pegar. El email MUST enviarse recortado y en minúsculas. La entidad de nacimiento MUST elegirse de una lista con los nombres del catálogo del contrato (CTR-21) y enviarse como código; la web MUST NOT rellenar la fecha ni la entidad a partir de la CURP, para que se contrasten como datos independientes (CTR-13). Si la API acepta el registro (`202`), la web MUST mostrar siempre el mismo mensaje genérico y llevar al usuario a la verificación, donde captura el código de 6 dígitos y puede pedir un reenvío. Si la API responde `422` con errores de campo, la web MUST mostrar cada mensaje bajo su campo y quedarse en el formulario. Al verificar, la web SHALL iniciar la sesión con los tokens recibidos y mostrar el resumen de cuentas. Si la verificación responde `403 REGISTRATION_IN_REVIEW` (IDN-06), la web MUST mostrar el mensaje de `REGISTRATION_IN_REVIEW` del paquete de diseño, MUST NOT iniciar sesión y MUST ofrecer volver al inicio de sesión.

#### Scenario: Registro enviado
- **WHEN** el usuario envía un registro válido
- **THEN** la web muestra "Si los datos son correctos, recibirás un correo con las instrucciones." y la pantalla de verificación

#### Scenario: CURP con dígito verificador inválido
- **WHEN** el usuario escribe una CURP cuyo último dígito no corresponde al cálculo del verificador
- **THEN** el formulario marca el campo CURP como inválido y no envía la petición

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

#### Scenario: Código incorrecto
- **WHEN** el usuario envía un código incorrecto y la API responde `VERIFICATION_CODE_INVALID` con `attemptsRemaining` 2
- **THEN** la web muestra "El código no es correcto o ya venció. Te quedan 2 intentos." (mensaje de `VERIFICATION_CODE_INVALID` del paquete de diseño más los intentos)

#### Scenario: Verificación exitosa
- **WHEN** el usuario envía el código correcto
- **THEN** la web crea la sesión y muestra el resumen con las cuentas "Principal" y "Ahorro" en $0.00

#### Scenario: Validación al salir del campo
- **WHEN** el usuario escribe unos nombres con un dígito y pasa al siguiente campo
- **THEN** el formulario marca los nombres como inválidos sin haber enviado el registro

#### Scenario: Fecha o entidad distintas de la CURP
- **WHEN** la fecha de nacimiento o la entidad elegidas no son las que codifica la CURP y el usuario sale del campo
- **THEN** el formulario marca la fecha con "La fecha no coincide con tu CURP" o la entidad con "La entidad no coincide con tu CURP"
- **AND** no envía la petición

#### Scenario: Apellido materno opcional
- **WHEN** el usuario deja vacío el apellido materno
- **THEN** el formulario no lo marca como inválido
- **AND** la petición no lleva `maternalSurname`

#### Scenario: Entidad por nombre
- **WHEN** el usuario elige "Ciudad de México" en la entidad de nacimiento
- **THEN** la petición lleva `birthState` igual a `"DF"`

#### Scenario: Registro en revisión al verificar
- **WHEN** el usuario envía el código correcto y la API responde `403` con `code` `REGISTRATION_IN_REVIEW`
- **THEN** la web muestra "Tu registro está en revisión. Te escribiremos a tu correo cuando terminemos." y un enlace para volver a iniciar sesión
- **AND** no crea ninguna sesión

### Requirement: WEB-12 Inicio de sesión
La web SHALL ofrecer un inicio de sesión con email y contraseña. Ante credenciales inválidas MUST mostrar un único mensaje genérico. Si la API responde `EMAIL_NOT_VERIFIED`, la web SHALL llevar al usuario a la verificación de ese correo. Si responde `REGISTRATION_IN_REVIEW`, la web MUST mostrar su mensaje y quedarse en el inicio de sesión. Si responde `RATE_LIMITED`, MUST indicar cuánto esperar según `Retry-After`.

#### Scenario: Credenciales inválidas
- **WHEN** la API responde `INVALID_CREDENTIALS`
- **THEN** la web muestra "El correo o la contraseña no coinciden." (mensaje de `INVALID_CREDENTIALS` del paquete de diseño) sin indicar cuál de los dos falló

#### Scenario: Correo sin verificar
- **WHEN** la API responde `403` con `code` `EMAIL_NOT_VERIFIED`
- **THEN** la web muestra la pantalla de verificación con el email precargado

#### Scenario: Demasiados intentos
- **WHEN** la API responde `429` con `Retry-After: 300`
- **THEN** la web muestra "Hiciste demasiados intentos. Espera un momento y vuelve a intentar. Intenta de nuevo en 5 minutos." (mensaje de `RATE_LIMITED` del paquete de diseño más la espera de `Retry-After`)

#### Scenario: Registro en revisión
- **WHEN** la API responde `403` con `code` `REGISTRATION_IN_REVIEW`
- **THEN** la web muestra "Tu registro está en revisión. Te escribiremos a tu correo cuando terminemos." (mensaje de `REGISTRATION_IN_REVIEW` del paquete de diseño) y no lleva a la verificación

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

### Requirement: WEB-14 Historial de movimientos
La web SHALL mostrar los movimientos de la cuenta seleccionada en orden descendente, con fecha, tipo, concepto, referencia, contraparte, monto con signo y saldo después del movimiento. MUST permitir cambiar de cuenta, filtrar por rango de fechas y por uno o varios tipos, y cargar la página siguiente con el cursor devuelto por la API. Al cambiar un filtro, la web MUST descartar el cursor y empezar desde la primera página.

#### Scenario: Cargar más
- **WHEN** la primera página trae `nextCursor` no nulo y el usuario pulsa "Cargar más"
- **THEN** la web pide la siguiente página con ese cursor y la agrega debajo de la lista

#### Scenario: Última página
- **WHEN** la API devuelve `nextCursor` nulo
- **THEN** la web oculta el botón "Cargar más"

#### Scenario: Cambio de filtro
- **WHEN** el usuario cambia el tipo a "Depósito" después de haber cargado dos páginas
- **THEN** la web pide la primera página con el nuevo filtro y sin cursor

#### Scenario: Cursor inválido
- **WHEN** la API responde `INVALID_CURSOR`
- **THEN** la web recarga la primera página con los filtros actuales

#### Scenario: Rango de fechas invertido
- **WHEN** el usuario elige en "Desde" una fecha posterior a la de "Hasta"
- **THEN** la web marca el campo "Hasta" con el error "Elige una fecha igual o posterior a la de Desde." y no consulta la API
- **AND** al corregir el rango vuelve a consultar la primera página con los filtros nuevos

### Requirement: WEB-15 Beneficiarios
La web SHALL listar los beneficiarios del usuario y permitir dar de alta uno con nombre, alias y CLABE de 18 dígitos. El formulario MUST validar el formato y el dígito verificador de la CLABE antes de enviar, y la web MUST mostrar un mensaje específico para `CLABE_INVALID`, `CLABE_NOT_IN_PLATFORM`, `BENEFICIARY_IS_OWN_ACCOUNT` y `BENEFICIARY_CONFLICT`.

#### Scenario: Dígito verificador incorrecto
- **WHEN** el usuario escribe `032180000118359718`
- **THEN** el formulario marca la CLABE como inválida y no envía la petición

#### Scenario: CLABE de una cuenta propia
- **WHEN** la API responde `BENEFICIARY_IS_OWN_ACCOUNT`
- **THEN** la web muestra `Esa CLABE es tuya. Para mover dinero entre tus cuentas, elige "Mis cuentas".` (mensaje de `BENEFICIARY_IS_OWN_ACCOUNT` del paquete de diseño)

#### Scenario: Alta exitosa
- **WHEN** la API responde `201` con el beneficiario
- **THEN** la web lo muestra en la lista sin recargar la página

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

### Requirement: WEB-17 Una sola transferencia por intento
La web SHALL generar la llave de idempotencia una sola vez, al pasar del formulario a la confirmación, y reutilizarla en cada reenvío del mismo intento. Si el usuario edita el formulario o recibe una respuesta definitiva (`COMPLETED`, `PENDING_OTP` o un rechazo), el siguiente envío MUST usar una llave nueva. El botón de envío MUST deshabilitarse desde el primer clic hasta recibir respuesta.

#### Scenario: Doble clic en "Enviar"
- **WHEN** el usuario hace doble clic en "Enviar" en la confirmación
- **THEN** la web envía una sola creación de transferencia
- **AND** el botón queda deshabilitado e indica que se está enviando

#### Scenario: Error de red y reintento
- **WHEN** la creación falla por error de red o con un `5xx`
- **AND** el usuario pulsa "Reintentar"
- **THEN** la web reenvía la creación con la misma llave
- **AND** si la API responde `200` con `Idempotent-Replayed: true`, la web muestra el estado actual de esa transferencia

#### Scenario: Edición tras un rechazo
- **WHEN** la transferencia fue rechazada por saldo insuficiente y el usuario cambia el monto
- **THEN** el siguiente envío lleva una llave distinta a la del intento rechazado

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

### Requirement: WEB-19 Mensajes por código de error
La web SHALL decidir qué mensaje mostrar según el `code` del problema, con un mensaje en español para cada código del contrato que pueda ocurrir en sus pantallas, y MUST usar un mensaje genérico con el `requestId` para `INTERNAL_ERROR` o cualquier código no previsto.

#### Scenario: Límite diario
- **WHEN** la API responde `DAILY_LIMIT_EXCEEDED` con `remaining` `"2000.00"`
- **THEN** la web muestra la alerta "Superaste tu límite diario" con "Esta transferencia supera lo que te queda del límite de hoy. Hoy puedes enviar hasta $2,000.00." (mensaje de `DAILY_LIMIT_EXCEEDED` del paquete de diseño más `remaining`)

#### Scenario: Error interno
- **WHEN** la API responde `INTERNAL_ERROR` con `requestId` `01JABC`
- **THEN** la web muestra "Algo falló de nuestro lado. Intenta de nuevo en unos minutos. Si contactas a soporte, menciona el código 01JABC." (mensaje de `INTERNAL_ERROR` del paquete de diseño más el `requestId`)

### Requirement: WEB-20 Estados de carga, vacío y error
Cada pantalla con datos del servidor SHALL mostrar un estado de carga mientras espera, un estado vacío con una acción sugerida cuando no hay datos y un estado de error con opción de reintentar cuando la lectura falla.

#### Scenario: Historial vacío
- **WHEN** la cuenta no tiene movimientos en el rango filtrado
- **THEN** la web muestra "No hay movimientos en este periodo" y la opción de limpiar filtros

#### Scenario: Beneficiarios vacíos
- **WHEN** el usuario no tiene beneficiarios
- **THEN** la web muestra "Aún no tienes beneficiarios" con el botón "Agregar beneficiario"

#### Scenario: Error de lectura
- **WHEN** la lectura de cuentas falla
- **THEN** la web muestra un mensaje de error y un botón "Reintentar" que repite la lectura

### Requirement: WEB-21 Montos sin floats ni redondeo
La web SHALL mostrar todos los montos con el formato de moneda `es-MX` en MXN a partir del string decimal de la API, sin convertirlos a números de punto flotante. Los montos capturados MUST validarse con las reglas del contrato y enviarse como string; un monto con más de 2 decimales MUST rechazarse en el formulario, nunca redondearse. Mientras se escribe o se pega, el campo de monto MUST admitir solo dígitos y un punto con un máximo de 2 decimales, mostrarse con separadores de miles (`12,345.67`) y enviarse sin ellos (`12345.67`).

#### Scenario: Formato de un monto
- **WHEN** la API devuelve un saldo `"1250.50"`
- **THEN** la web muestra "$1,250.50"

#### Scenario: Monto con tres decimales
- **WHEN** el usuario escribe `100.005` como monto
- **THEN** el campo conserva `100.00` y no admite el tercer decimal

#### Scenario: Monto con separadores
- **WHEN** el usuario escribe `1,250.50`
- **THEN** la web envía el monto como `"1250.50"`

#### Scenario: Letras y símbolos
- **WHEN** el usuario escribe o pega `"12a,345.678 MXN"` en el monto
- **THEN** el campo muestra `12,345.67` y la petición lleva `"12345.67"`

#### Scenario: Cursor al dar formato
- **WHEN** el usuario teclea un dígito que hace aparecer una coma de miles en medio del número
- **THEN** el cursor se queda junto al mismo dígito

### Requirement: WEB-22 Rutas protegidas
Las pantallas de cuentas, historial, beneficiarios y transferencias SHALL requerir una sesión activa; sin ella, la web MUST llevar al usuario al inicio de sesión y, después de iniciar sesión, devolverlo a la pantalla que intentaba abrir dentro de la misma web.

#### Scenario: Acceso sin sesión
- **WHEN** un visitante sin sesión abre la pantalla de historial
- **THEN** la web lo lleva al inicio de sesión
- **AND** al iniciar sesión lo devuelve al historial

#### Scenario: Redirección a otro sitio
- **WHEN** el parámetro de retorno apunta a un dominio externo
- **THEN** la web ignora ese destino y muestra el resumen de cuentas

### Requirement: WEB-23 Accesibilidad básica
La web SHALL poder usarse completa con teclado, con foco visible, cada campo de formulario MUST tener una etiqueta asociada, los errores de formulario y de operación MUST anunciarse a lectores de pantalla, y el texto MUST tener un contraste mínimo de 4.5:1 frente a su fondo.

#### Scenario: Transferencia solo con teclado
- **WHEN** un usuario completa el flujo de transferencia usando solo Tab, Shift+Tab, Enter y Espacio
- **THEN** llega al comprobante sin necesitar el ratón y el foco siempre es visible

#### Scenario: Error anunciado
- **WHEN** la confirmación falla con saldo insuficiente
- **THEN** el mensaje de error se anuncia a los lectores de pantalla y el foco se mueve a él

#### Scenario: Campos etiquetados
- **WHEN** se analiza el formulario de beneficiario con una herramienta de accesibilidad
- **THEN** cada campo tiene una etiqueta asociada y no hay errores de contraste

### Requirement: WEB-24 Layout responsivo con dos formas
La web SHALL mostrar la forma de app (contenido en una columna, barra de pestañas inferior y encabezado de la app) en anchos menores a 1024 px, centrada en una columna de 480 px a partir de 480 px de ancho, y la forma de *dashboard* (navegación lateral, barra superior y paneles) desde 1024 px. Ningún ancho entre 320 y 1920 px MUST producir desplazamiento horizontal de la página.

#### Scenario: Teléfono
- **WHEN** se abre Inicio en una ventana de 390 px de ancho
- **THEN** se ve la forma de app con la barra de pestañas y sin navegación lateral

#### Scenario: Escritorio
- **WHEN** se abre Inicio en una ventana de 1280 px de ancho
- **THEN** se ve la navegación lateral y la barra superior, y no se ve la barra de pestañas

#### Scenario: Sin desplazamiento horizontal
- **WHEN** se recorre cada pantalla a 320, 390, 768, 1024 y 1440 px de ancho
- **THEN** el ancho del documento nunca supera el de la ventana

### Requirement: WEB-25 Paridad visual con la app móvil en teléfono
En la forma de app, cada pantalla web que tiene equivalente en la app móvil (inicio de sesión, Inicio, Movimientos y cada paso y estado del flujo de transferencia) SHALL ser visualmente indistinguible de la pantalla móvil: misma estructura y orden, mismos tamaños tipográficos, colores, espaciados, radios e iconos. Las pantallas que solo existen en la web (registro, verificación de correo y beneficiarios) MUST usar los mismos componentes y patrones de la forma de app.

#### Scenario: Pareja de pantallas equivalentes
- **WHEN** se capturan a 390×844 la pantalla web de Inicio y la pantalla móvil de Inicio con los mismos datos
- **THEN** coinciden la estructura, el orden, los tamaños, los colores, los espaciados y los radios, y solo difieren en el suavizado del texto

#### Scenario: Pantalla solo web
- **WHEN** se abre el registro a 390 px de ancho
- **THEN** usa el encabezado, los campos, los botones de ancho completo y el pie fijo de la forma de app

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

### Requirement: WEB-27 Navegación de la app en teléfono
En la forma de app, la web SHALL mostrar una barra de pestañas con Inicio, Movimientos, Transferir y Beneficiarios, y un encabezado con un avatar que abre el menú de la cuenta con "Cerrar sesión". Durante el flujo de transferencia la barra de pestañas MUST ocultarse.

#### Scenario: Pestañas en teléfono
- **WHEN** se abre Movimientos a 390 px
- **THEN** la barra de pestañas muestra las cuatro pestañas y Movimientos está marcada como actual

#### Scenario: Flujo de transferencia a pantalla completa
- **WHEN** el usuario entra al flujo de transferencia a 390 px
- **THEN** no se ve la barra de pestañas y el flujo ocupa la pantalla

#### Scenario: Programadas en teléfono
Precisa WEB-34 (change `scheduled-transfers`), que pide ofrecer "Programadas" en la navegación de la web.
- **WHEN** el usuario busca sus transferencias programadas a 390 px
- **THEN** la barra de pestañas conserva sus cuatro pestañas, sin "Programadas", y el paso del destinatario del flujo de transferencia ofrece el enlace "Transferencias programadas" a `/transfers/scheduled`
- **AND** desde 1024 px la navegación lateral lista "Programadas" con su propio icono y ese enlace del paso no se muestra

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

### Requirement: WEB-29 Movimientos agrupados por día
Movimientos SHALL mostrar un selector de cuenta y la lista agrupada por día de Ciudad de México con encabezados "Hoy", "Ayer" o la fecha corta. Los filtros y la paginación de WEB-14 MUST conservarse, en una hoja inferior en la forma de app y en un panel en la forma de *dashboard*. Amplía WEB-14.

#### Scenario: Agrupación por día
- **WHEN** hay movimientos de hoy, de ayer y del 9 de octubre
- **THEN** la lista los agrupa bajo "Hoy", "Ayer" y "9 oct", con las fechas de Ciudad de México

#### Scenario: Filtros en teléfono
- **WHEN** el usuario abre los filtros a 390 px
- **THEN** aparecen en una hoja inferior y al aplicarlos la lista se actualiza como indica WEB-14

### Requirement: WEB-30 Flujo de transferencia por pasos
El flujo de transferencia SHALL seguir los pasos Destinatario, Monto y concepto, Revisión, Código (cuando la transferencia lo requiera) y Comprobante, con un indicador del paso actual. El paso de destinatario MUST ofrecer las cuentas propias y los beneficiarios. En la forma de *dashboard* el flujo MUST mostrarse en un panel central con un resumen de la transferencia a un lado. Los comportamientos de WEB-16, WEB-17, WEB-18 y WEB-19 MUST conservarse. Amplía WEB-16.

#### Scenario: Indicador de pasos
- **WHEN** el usuario está en la revisión de una transferencia que requiere código
- **THEN** el indicador muestra el paso 3 de 5 y lo anuncia a los lectores de pantalla

#### Scenario: Transferencia entre cuentas propias
- **WHEN** el usuario elige su cuenta de Ahorro en el paso de destinatario
- **THEN** el flujo continúa como una transferencia entre cuentas propias sin pedir beneficiario

#### Scenario: Doble clic en Enviar
- **WHEN** el usuario hace doble clic en "Enviar" en la revisión
- **THEN** se crea una sola transferencia, como indica WEB-17

### Requirement: WEB-31 Pantallas públicas de marca
El inicio de sesión, el registro y la verificación de correo SHALL mostrarse sobre una superficie de marca (verde profundo con el Wordmark) con el formulario en una hoja blanca: a pantalla completa en la forma de app y en un panel dividido en la forma de *dashboard*. Amplía WEB-11 y WEB-12.

#### Scenario: Inicio de sesión en escritorio
- **WHEN** se abre el inicio de sesión a 1280 px
- **THEN** se ve el panel de marca a un lado y el formulario en una hoja blanca al otro

#### Scenario: Inicio de sesión en teléfono
- **WHEN** se abre el inicio de sesión a 390 px
- **THEN** coincide con la pantalla de inicio de sesión de la app móvil, como indica WEB-25

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

### Requirement: WEB-37 Sesión que sobrevive al reinicio del servidor web
Cuando la web tenga configurado un almacén de sesiones externo, la sesión SHALL sobrevivir al reinicio del proceso del servidor web: la misma cookie MUST seguir identificando la sesión, con su access y su refresh token, sin pedir de nuevo el inicio de sesión. El almacén externo MUST aplicar la misma expiración que WEB-03 (inactividad y vigencia absoluta). Renovar el plazo de inactividad MUST NOT reemplazar los tokens que guarde al mismo tiempo una renovación (WEB-04) ni volver a crear una sesión que ya expiró o se cerró. Si el almacén externo no responde, la web MUST responder con un error del servidor sin cerrar la sesión ni usar otro almacén. Sin almacén externo configurado, la web SHALL guardar las sesiones en la memoria del proceso.

#### Scenario: Reinicio del servidor con la sesión activa
- **WHEN** el usuario inicia sesión, el servidor web se reinicia y el usuario abre sus cuentas antes de 15 minutos
- **THEN** la web muestra sus cuentas sin pedirle iniciar sesión

#### Scenario: Inactividad con el almacén externo
- **WHEN** pasan más de 15 minutos sin peticiones del usuario
- **THEN** la sesión ya no está en el almacén externo y el usuario vuelve al inicio de sesión como en WEB-03

#### Scenario: Renovación del plazo durante una renovación de tokens
- **WHEN** una petición renueva el plazo de inactividad mientras otra guarda el par de tokens renovado
- **THEN** la sesión conserva el par de tokens renovado

#### Scenario: Renovación del plazo de una sesión cerrada
- **WHEN** una petición renueva el plazo de inactividad de una sesión que el usuario acaba de cerrar
- **THEN** la sesión no vuelve a existir en el almacén externo

#### Scenario: Almacén externo caído
- **WHEN** el almacén externo no responde al abrir una pantalla con sesión
- **THEN** la petición termina con un error del servidor en vez de quedarse esperando
- **AND** la cookie de sesión se conserva para cuando el almacén vuelva

#### Scenario: Sin almacén externo
- **WHEN** la web arranca sin almacén externo configurado
- **THEN** las sesiones se guardan en la memoria del proceso, como en WEB-03
