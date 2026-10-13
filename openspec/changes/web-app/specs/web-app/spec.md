## Purpose

Panel web de la billetera que actúa como intermediario (BFF) entre el navegador y la API: guarda la sesión en el servidor para que los tokens nunca lleguen al navegador y ofrece las pantallas de registro, cuentas, historial, beneficiarios y transferencias con estados claros y sin errores de saldo.

## ADDED Requirements

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
La web SHALL ofrecer un registro con email, contraseña, nombre completo, CURP, RFC y teléfono, validados en el formulario con las reglas del contrato. Tras enviarlo, la web MUST mostrar siempre el mismo mensaje genérico y llevar al usuario a la verificación, donde captura el código de 6 dígitos y puede pedir un reenvío. Al verificar, la web SHALL iniciar la sesión con los tokens recibidos y mostrar el resumen de cuentas.

#### Scenario: Registro enviado
- **WHEN** el usuario envía un registro válido
- **THEN** la web muestra "Si los datos son correctos, recibirás un correo con las instrucciones" y la pantalla de verificación

#### Scenario: CURP con dígito verificador inválido
- **WHEN** el usuario escribe una CURP cuyo último dígito no corresponde al cálculo del verificador
- **THEN** el formulario marca el campo CURP como inválido y no envía la petición

#### Scenario: Código incorrecto
- **WHEN** el usuario envía un código incorrecto y la API responde `VERIFICATION_CODE_INVALID` con `attemptsRemaining` 2
- **THEN** la web muestra "Código incorrecto. Te quedan 2 intentos"

#### Scenario: Verificación exitosa
- **WHEN** el usuario envía el código correcto
- **THEN** la web crea la sesión y muestra el resumen con las cuentas "Principal" y "Ahorro" en $0.00

### Requirement: WEB-12 Inicio de sesión
La web SHALL ofrecer un inicio de sesión con email y contraseña. Ante credenciales inválidas MUST mostrar un único mensaje genérico. Si la API responde `EMAIL_NOT_VERIFIED`, la web SHALL llevar al usuario a la verificación de ese correo. Si responde `RATE_LIMITED`, MUST indicar cuánto esperar según `Retry-After`.

#### Scenario: Credenciales inválidas
- **WHEN** la API responde `INVALID_CREDENTIALS`
- **THEN** la web muestra "Email o contraseña incorrectos" sin indicar cuál de los dos falló

#### Scenario: Correo sin verificar
- **WHEN** la API responde `403` con `code` `EMAIL_NOT_VERIFIED`
- **THEN** la web muestra la pantalla de verificación con el email precargado

#### Scenario: Demasiados intentos
- **WHEN** la API responde `429` con `Retry-After: 300`
- **THEN** la web muestra "Demasiados intentos. Intenta de nuevo en 5 minutos"

### Requirement: WEB-13 Resumen de cuentas
La web SHALL mostrar las cuentas del usuario con su nombre, CLABE y saldo, y el límite diario de transferencias con lo usado y lo restante del día ("Te quedan $X hoy").

#### Scenario: Cuentas con saldo
- **WHEN** el usuario abre el resumen y la API devuelve "Principal" con `"25000.00"` y "Ahorro" con `"10000.00"`
- **THEN** la web muestra "$25,000.00" y "$10,000.00"

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

### Requirement: WEB-15 Beneficiarios
La web SHALL listar los beneficiarios del usuario y permitir dar de alta uno con nombre, alias y CLABE de 18 dígitos. El formulario MUST validar el formato y el dígito verificador de la CLABE antes de enviar, y la web MUST mostrar un mensaje específico para `CLABE_INVALID`, `CLABE_NOT_IN_PLATFORM`, `BENEFICIARY_IS_OWN_ACCOUNT` y `BENEFICIARY_CONFLICT`.

#### Scenario: Dígito verificador incorrecto
- **WHEN** el usuario escribe `032180000118359718`
- **THEN** el formulario marca la CLABE como inválida y no envía la petición

#### Scenario: CLABE de una cuenta propia
- **WHEN** la API responde `BENEFICIARY_IS_OWN_ACCOUNT`
- **THEN** la web muestra "Esa CLABE es de una de tus cuentas. Usa la transferencia entre tus cuentas"

#### Scenario: Alta exitosa
- **WHEN** la API responde `201` con el beneficiario
- **THEN** la web lo muestra en la lista sin recargar la página

### Requirement: WEB-16 Flujo de transferencia
La web SHALL guiar la transferencia en pasos: formulario (cuenta origen, destino propio o beneficiario, monto, concepto y referencia), confirmación con el resumen, código OTP cuando la transferencia quede `PENDING_OTP` y comprobante final. Como destino propio MUST ofrecer solo cuentas del usuario distintas de la cuenta origen. El comprobante MUST mostrar estado, monto, origen, destino, concepto, referencia, fecha y el identificador de la transferencia.

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
- **AND** si la API responde `SAME_ACCOUNT_TRANSFER`, la web muestra "El origen y el destino no pueden ser la misma cuenta"

#### Scenario: Saldo insuficiente
- **WHEN** la API responde `422` con `code` `INSUFFICIENT_FUNDS`
- **THEN** la web muestra "Saldo insuficiente" junto al saldo disponible de la cuenta origen
- **AND** permite corregir el monto, lo que inicia un intento nuevo

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
La web SHALL permitir capturar el código de 6 dígitos, mostrar los intentos restantes tras un código incorrecto, reenviar el código mientras queden reenvíos y avisar cuando la transferencia expiró o falló. Si el envío del correo falló (`deliveryStatus` `FAILED`), MUST ofrecer reenviar el código. El botón de confirmar MUST deshabilitarse mientras se envía.

#### Scenario: Código incorrecto
- **WHEN** la API responde `OTP_INVALID` con `attemptsRemaining` 1
- **THEN** la web muestra "Código incorrecto. Te queda 1 intento"

#### Scenario: Intentos agotados
- **WHEN** la API responde `OTP_ATTEMPTS_EXHAUSTED`
- **THEN** la web muestra que la transferencia no se realizó y ofrece iniciar una nueva

#### Scenario: Transferencia expirada
- **WHEN** la API responde `409` con `code` `TRANSFER_EXPIRED`
- **THEN** la web muestra "El código expiró. Inicia la transferencia de nuevo"

#### Scenario: Doble clic en "Confirmar"
- **WHEN** el usuario hace doble clic en "Confirmar"
- **THEN** la web envía una sola confirmación

#### Scenario: Revalidación fallida al confirmar
- **WHEN** la API responde `DAILY_LIMIT_EXCEEDED` al confirmar
- **THEN** la web muestra "Superaste tu límite diario" con el monto restante del día

### Requirement: WEB-19 Mensajes por código de error
La web SHALL decidir qué mensaje mostrar según el `code` del problema, con un mensaje en español para cada código del contrato que pueda ocurrir en sus pantallas, y MUST usar un mensaje genérico con el `requestId` para `INTERNAL_ERROR` o cualquier código no previsto.

#### Scenario: Límite diario
- **WHEN** la API responde `DAILY_LIMIT_EXCEEDED` con `remaining` `"2000.00"`
- **THEN** la web muestra "Superaste tu límite diario. Hoy puedes enviar hasta $2,000.00"

#### Scenario: Error interno
- **WHEN** la API responde `INTERNAL_ERROR` con `requestId` `01JABC`
- **THEN** la web muestra "Algo salió mal. Si contactas a soporte, menciona el código 01JABC"

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
La web SHALL mostrar todos los montos con el formato de moneda `es-MX` en MXN a partir del string decimal de la API, sin convertirlos a números de punto flotante. Los montos capturados MUST validarse con las reglas del contrato y enviarse como string; un monto con más de 2 decimales MUST rechazarse en el formulario, nunca redondearse.

#### Scenario: Formato de un monto
- **WHEN** la API devuelve un saldo `"1250.50"`
- **THEN** la web muestra "$1,250.50"

#### Scenario: Monto con tres decimales
- **WHEN** el usuario escribe `100.005` como monto
- **THEN** el formulario muestra "Máximo 2 decimales" y no envía la petición

#### Scenario: Monto con separadores
- **WHEN** el usuario escribe `1,250.50`
- **THEN** la web envía el monto como `"1250.50"`

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
