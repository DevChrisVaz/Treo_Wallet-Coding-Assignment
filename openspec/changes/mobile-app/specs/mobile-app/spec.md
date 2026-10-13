## Purpose

App móvil de la billetera (alcance reducido del enunciado): permite iniciar sesión, consultar el saldo y los últimos movimientos, y enviar transferencias a beneficiarios ya registrados de forma segura aunque la red sea inestable, sin perder ni duplicar dinero.

## ADDED Requirements

### Requirement: MOB-01 Inicio de sesión
La app SHALL permitir iniciar sesión con email y contraseña contra la API y, al tener éxito, SHALL llevar al usuario a la pantalla de saldo. La app MUST mostrar el mismo mensaje genérico para cualquier credencial inválida y MUST NOT ofrecer registro ni verificación de correo; un usuario con el correo sin verificar SHALL ver un mensaje que le indica completar la verificación en la web.

#### Scenario: Credenciales válidas
- **WHEN** el usuario envía un email y una contraseña correctos de una cuenta verificada
- **THEN** la app guarda la sesión y muestra la pantalla de saldo

#### Scenario: Credenciales inválidas
- **WHEN** la API responde `401` con `code` `INVALID_CREDENTIALS`
- **THEN** la app muestra "Email o contraseña incorrectos" sin indicar cuál de los dos falló
- **AND** la contraseña capturada se borra del formulario

#### Scenario: Correo sin verificar
- **WHEN** la API responde `403` con `code` `EMAIL_NOT_VERIFIED`
- **THEN** la app muestra un mensaje que indica completar la verificación del correo desde la web
- **AND** no guarda ningún token

#### Scenario: Demasiados intentos
- **WHEN** la API responde `429` con `code` `RATE_LIMITED` y el header `Retry-After`
- **THEN** la app deshabilita el botón de iniciar sesión durante los segundos indicados y muestra cuánto falta

### Requirement: MOB-02 Almacenamiento seguro de tokens
La app MUST guardar el refresh token únicamente en el almacenamiento seguro del sistema operativo (Keychain en iOS, Keystore en Android) y MUST mantener el access token solo en memoria. La app MUST NOT escribir ningún token en almacenamiento de propósito general sin cifrar ni en los logs. Al abrir la app, SHALL restaurar la sesión renovándola con el refresh token guardado.

#### Scenario: Tokens tras iniciar sesión
- **WHEN** el inicio de sesión es exitoso
- **THEN** el refresh token queda guardado en el almacenamiento seguro
- **AND** el access token no se escribe en ningún almacenamiento persistente

#### Scenario: Ningún token en almacenamiento sin cifrar
- **WHEN** se inspecciona el almacenamiento de propósito general de la app después de iniciar sesión, renovar la sesión y transferir
- **THEN** no contiene ningún access token ni refresh token

#### Scenario: Restaurar la sesión al abrir la app
- **WHEN** la app se abre y existe un refresh token en el almacenamiento seguro
- **THEN** la app lo usa para obtener un nuevo par de tokens y muestra la pantalla de saldo sin pedir credenciales

#### Scenario: Sin refresh token guardado
- **WHEN** la app se abre y no hay refresh token en el almacenamiento seguro
- **THEN** la app muestra la pantalla de inicio de sesión

### Requirement: MOB-03 Renovación de la sesión de una sola vez
Cuando una petición autenticada recibe `401 UNAUTHENTICATED`, la app SHALL renovar la sesión y repetir esa petición una sola vez. Si varias peticiones necesitan renovar al mismo tiempo, la app MUST hacer una sola llamada de renovación y compartir su resultado. Si la renovación responde `401 SESSION_REVOKED`, la app MUST borrar los tokens y volver al inicio de sesión. La app SHALL guardar en el almacenamiento seguro el nuevo refresh token de cada renovación.

#### Scenario: Access token vencido
- **WHEN** una petición autenticada responde `401` con `code` `UNAUTHENTICATED`
- **THEN** la app renueva la sesión, guarda el nuevo refresh token y repite la petición original una sola vez

#### Scenario: Varias peticiones con el token vencido
- **WHEN** tres peticiones autenticadas reciben `401 UNAUTHENTICATED` al mismo tiempo
- **THEN** la app hace exactamente una llamada de renovación
- **AND** las tres peticiones se repiten con el nuevo access token

#### Scenario: Sesión revocada
- **WHEN** la renovación responde `401` con `code` `SESSION_REVOKED`
- **THEN** la app borra el refresh token del almacenamiento seguro y el access token de memoria
- **AND** muestra la pantalla de inicio de sesión con el mensaje "Tu sesión expiró"

### Requirement: MOB-04 Cierre de sesión
La app SHALL permitir cerrar sesión. Al hacerlo, SHALL pedir a la API la revocación del refresh token y MUST borrar los tokens locales aunque la API no responda.

#### Scenario: Cierre de sesión con red
- **WHEN** el usuario cierra sesión y la API responde `204`
- **THEN** la app borra los tokens y muestra la pantalla de inicio de sesión

#### Scenario: Cierre de sesión sin red
- **WHEN** el usuario cierra sesión y la petición a la API falla por falta de red
- **THEN** la app borra igualmente los tokens locales y muestra la pantalla de inicio de sesión

### Requirement: MOB-05 Saldo de las cuentas
La app SHALL mostrar las cuentas del usuario con su nombre, los últimos 4 dígitos de su CLABE y su saldo, junto con lo que queda del límite diario de transferencias. La pantalla MUST tener estados de carga, vacío y error, y SHALL permitir actualizar los datos manualmente.

#### Scenario: Cuentas con saldo
- **WHEN** la API devuelve las cuentas "Principal" con `"25000.00"` y "Ahorro" con `"10000.00"`
- **THEN** la app muestra "$25,000.00" y "$10,000.00" con el formato de `es-MX`
- **AND** muestra el monto restante del límite diario

#### Scenario: Error al cargar
- **WHEN** la consulta de cuentas falla
- **THEN** la app muestra un mensaje de error con un botón para reintentar
- **AND** no muestra saldos anteriores como si fueran actuales

#### Scenario: Actualizar manualmente
- **WHEN** el usuario desliza hacia abajo en la pantalla de saldo
- **THEN** la app vuelve a consultar las cuentas y actualiza los saldos mostrados

### Requirement: MOB-06 Últimos 20 movimientos
La app SHALL mostrar los últimos 20 movimientos de la cuenta que el usuario elija, del más reciente al más antiguo, con su tipo, concepto, contraparte, monto con signo y saldo resultante. La pantalla MUST tener estados de carga, vacío y error.

#### Scenario: Cuenta con movimientos
- **WHEN** el usuario abre una cuenta con más de 20 movimientos
- **THEN** la app muestra exactamente los 20 más recientes, ordenados del más reciente al más antiguo

#### Scenario: Salidas y entradas
- **WHEN** la lista incluye un movimiento `TRANSFER_OUT` de `"-150.00"` y un `DEPOSIT` de `"25000.00"`
- **THEN** la app muestra la salida como "-$150.00" con la etiqueta "Transferencia enviada" y la entrada como "$25,000.00" con la etiqueta "Depósito"

#### Scenario: Cuenta sin movimientos
- **WHEN** la cuenta no tiene movimientos
- **THEN** la app muestra un estado vacío que lo indica

### Requirement: MOB-07 Selección de beneficiario registrado
Para transferir, la app SHALL mostrar los beneficiarios ya registrados del usuario y MUST permitir transferir solo a uno de ellos. La app MUST NOT permitir registrar beneficiarios; si el usuario no tiene ninguno, SHALL indicar que debe registrarlos desde la web.

#### Scenario: Lista de beneficiarios
- **WHEN** el usuario inicia una transferencia y tiene beneficiarios registrados
- **THEN** la app los muestra con su alias, su nombre y los últimos 4 dígitos de su CLABE

#### Scenario: Sin beneficiarios
- **WHEN** el usuario inicia una transferencia y no tiene beneficiarios
- **THEN** la app muestra un estado vacío que indica registrar beneficiarios desde la web
- **AND** no ofrece ningún formulario de alta

### Requirement: MOB-08 Captura y validación de la transferencia
La app SHALL pedir la cuenta de origen, el monto, el concepto y la referencia, y MUST validarlos con las mismas reglas del contrato antes de enviarlos: monto mayor que 0 con un máximo de 2 decimales y 12 dígitos enteros, concepto de 1 a 40 caracteres sin espacios al inicio ni al final y referencia de 1 a 7 dígitos. La app MUST rechazar un monto con más de 2 decimales en lugar de redondearlo y MUST enviar el monto como string decimal, sin convertirlo a número de punto flotante.

#### Scenario: Monto con más de dos decimales (redondeo)
- **WHEN** el usuario captura el monto `100.005`
- **THEN** la app muestra el error "Máximo 2 decimales" junto al campo
- **AND** no envía la transferencia ni redondea el monto a `100.01`

#### Scenario: Monto válido sin centavos
- **WHEN** el usuario captura el monto `1250`
- **THEN** la app lo acepta y lo envía como el string `"1250"`

#### Scenario: Monto cero
- **WHEN** el usuario captura el monto `0.00`
- **THEN** la app muestra un error indicando que el monto debe ser mayor que 0

#### Scenario: Referencia no numérica
- **WHEN** el usuario captura la referencia `12A45`
- **THEN** la app muestra un error indicando que la referencia solo admite de 1 a 7 dígitos

### Requirement: MOB-09 Confirmación previa y envío único
Antes de enviar, la app SHALL mostrar un resumen con la cuenta de origen, el beneficiario, el monto, el concepto, la referencia y si se pedirá un código por correo. La app MUST generar una sola `Idempotency-Key` por intento de transferencia y MUST deshabilitar el botón de enviar mientras la petición está en curso. Si el usuario vuelve a editar los datos, el siguiente envío MUST usar una llave nueva.

#### Scenario: Doble toque en Enviar
- **WHEN** el usuario toca "Enviar" dos veces seguidas en la pantalla de confirmación
- **THEN** la app hace una sola petición de creación de transferencia
- **AND** el botón permanece deshabilitado hasta recibir una respuesta definitiva o agotar los reintentos

#### Scenario: Aviso de OTP
- **WHEN** el monto capturado es `15000.00`
- **THEN** el resumen indica que se enviará un código de confirmación al correo del usuario

#### Scenario: Edición después de un rechazo
- **WHEN** una transferencia es rechazada por saldo insuficiente y el usuario corrige el monto y vuelve a enviar
- **THEN** la nueva petición usa una `Idempotency-Key` distinta de la del intento rechazado

### Requirement: MOB-10 Reintento ante pérdida de red con la misma llave
Si la red se pierde a mitad de una transferencia, la app SHALL reintentar automáticamente con la misma `Idempotency-Key` y el mismo payload, con espera exponencial y hasta 5 reintentos, ante falta de conexión, tiempo de espera agotado o respuesta `5xx`. Al recuperarse la conexión, la app SHALL reintentar de inmediato. La app MUST mostrar el estado real que devuelve la API en la respuesta, incluido el de un reintento reconocido (`200` con `Idempotent-Replayed: true`). Las respuestas `4xx` MUST tratarse como definitivas y no se reintentan.

#### Scenario: Pérdida de red a mitad de una transferencia
- **WHEN** la app envía una transferencia, la API la completa pero la respuesta se pierde por falta de red
- **AND** la conexión se recupera
- **THEN** la app reintenta con la misma `Idempotency-Key` y el mismo payload
- **AND** muestra el estado `COMPLETED` que devuelve la API, sin crear una segunda transferencia

#### Scenario: Error del servidor transitorio
- **WHEN** la creación de la transferencia responde `503` dos veces y después `201`
- **THEN** la app reintenta con espera creciente usando la misma llave y muestra el resultado de la respuesta `201`

#### Scenario: Rechazo definitivo
- **WHEN** la creación de la transferencia responde `422` con `code` `INSUFFICIENT_FUNDS`
- **THEN** la app no reintenta y muestra el mensaje de saldo insuficiente

#### Scenario: Reintento de una transferencia ya rechazada
- **WHEN** un reintento con la misma llave recibe `422` con `code` `INSUFFICIENT_FUNDS` y el header `Idempotent-Replayed: true`
- **THEN** la app muestra el rechazo como resultado definitivo del intento

### Requirement: MOB-11 Estado incierto y reintento manual
Si se agotan los reintentos automáticos sin una respuesta definitiva, la app SHALL mostrar el mensaje "No pudimos confirmar el estado de tu transferencia" con una opción para reintentar. El reintento manual MUST usar la misma `Idempotency-Key` y el mismo payload del intento original. La app MUST NOT presentar la transferencia como exitosa ni como fallida mientras el estado sea incierto.

#### Scenario: Reintentos agotados
- **WHEN** los 5 reintentos automáticos fallan por falta de red
- **THEN** la app muestra "No pudimos confirmar el estado de tu transferencia" y un botón "Reintentar"
- **AND** no muestra la transferencia como completada ni como fallida

#### Scenario: Reintento manual
- **WHEN** el usuario toca "Reintentar" en el estado incierto
- **THEN** la app envía la petición con la misma `Idempotency-Key` y el mismo payload del intento original

### Requirement: MOB-12 Confirmación con OTP
Cuando la transferencia queda en `PENDING_OTP`, la app SHALL pedir el código de 6 dígitos enviado por correo, mostrando el correo enmascarado, el tiempo restante y los intentos que quedan. La app SHALL permitir reenviar el código mientras queden reenvíos. La confirmación MUST reintentarse ante pérdida de red igual que la creación, ya que la API la trata como idempotente por estado.

#### Scenario: Código correcto
- **WHEN** el usuario envía el código correcto antes de que venza
- **THEN** la app muestra el resultado con estado `COMPLETED`

#### Scenario: Código incorrecto
- **WHEN** la confirmación responde `422` con `code` `OTP_INVALID` y `attemptsRemaining` igual a 1
- **THEN** la app muestra "Código incorrecto, te queda 1 intento" y conserva la pantalla del código

#### Scenario: Intentos agotados
- **WHEN** la confirmación responde `422` con `code` `OTP_ATTEMPTS_EXHAUSTED`
- **THEN** la app muestra que la transferencia no se realizó por exceder los intentos permitidos

#### Scenario: Código vencido
- **WHEN** la confirmación responde `409` con `code` `TRANSFER_EXPIRED`
- **THEN** la app muestra que el tiempo para confirmar terminó y ofrece iniciar un nuevo intento

#### Scenario: Correo no enviado
- **WHEN** la transferencia se crea en `PENDING_OTP` con `otp.deliveryStatus` igual a `FAILED`
- **THEN** la app indica que el código no pudo enviarse y ofrece reenviarlo

#### Scenario: Límite de reenvíos
- **WHEN** el reenvío responde `422` con `code` `RESEND_LIMIT_REACHED`
- **THEN** la app oculta la opción de reenviar y muestra que ya no hay reenvíos disponibles

#### Scenario: Pérdida de red al confirmar
- **WHEN** la API completa la transferencia pero la respuesta de la confirmación se pierde y la app reintenta con el mismo código
- **THEN** la app muestra el estado `COMPLETED` que devuelve la API

### Requirement: MOB-13 Resultado con el estado real
Al terminar un intento, la app SHALL mostrar el estado que devolvió la API: un comprobante para `COMPLETED` con monto, beneficiario, concepto, referencia, fecha e identificador de la transferencia, o el motivo para `REJECTED`, `FAILED` o `EXPIRED`. Los datos del comprobante MUST provenir de la respuesta de la API y no de lo que capturó el usuario.

#### Scenario: Comprobante
- **WHEN** la API devuelve una transferencia `COMPLETED`
- **THEN** la app muestra el comprobante con el monto devuelto por la API formateado en `es-MX`, el beneficiario, el concepto, la referencia, la fecha y el identificador

#### Scenario: Saldos actualizados después de transferir
- **WHEN** el usuario vuelve a la pantalla de saldo después de una transferencia `COMPLETED`
- **THEN** la app muestra los saldos consultados de nuevo a la API

### Requirement: MOB-14 Mensajes de error por código
La app SHALL decidir el mensaje que muestra a partir del `code` del problema RFC 9457 y nunca a partir de `type`, `title` o `detail`. Ante un `code` desconocido o un error interno, la app MUST mostrar un mensaje genérico con el `requestId` para soporte y MUST NOT mostrar detalles técnicos.

#### Scenario: Saldo insuficiente
- **WHEN** la API responde `422` con `code` `INSUFFICIENT_FUNDS`
- **THEN** la app muestra "Saldo insuficiente para esta transferencia"

#### Scenario: Límite diario excedido
- **WHEN** la API responde `422` con `code` `DAILY_LIMIT_EXCEEDED` y `remaining` igual a `"5000.00"`
- **THEN** la app muestra que se excede el límite diario y que hoy quedan "$5,000.00" disponibles

#### Scenario: Error interno
- **WHEN** la API responde `500` con `code` `INTERNAL_ERROR` y un `requestId`
- **THEN** la app muestra un mensaje genérico que incluye el `requestId`
- **AND** no muestra trazas, SQL ni mensajes internos

### Requirement: MOB-15 Montos sin punto flotante
La app MUST mostrar todos los montos a partir de los strings decimales que devuelve la API, con el formato de moneda de `es-MX` (MXN), y MUST NOT hacer operaciones aritméticas sobre montos con números de punto flotante.

#### Scenario: Formato de un monto grande
- **WHEN** la API devuelve el saldo `"1234567.89"`
- **THEN** la app muestra "$1,234,567.89"

#### Scenario: Monto con centavos exactos
- **WHEN** la API devuelve el monto `"0.10"`
- **THEN** la app muestra "$0.10" sin errores de precisión

### Requirement: MOB-16 Privacidad en segundo plano
Cuando la app deja de estar activa (pasa a segundo plano o al selector de apps), SHALL cubrir todo el contenido con una pantalla de privacidad que no muestre saldos, movimientos ni datos personales, y SHALL retirarla al volver a estar activa.

#### Scenario: App a segundo plano
- **WHEN** la app pasa de activa a inactiva o a segundo plano mientras muestra saldos
- **THEN** la pantalla de privacidad cubre el contenido antes de que el sistema capture la vista del selector de apps

#### Scenario: Regreso a la app
- **WHEN** la app vuelve a estar activa
- **THEN** la pantalla de privacidad desaparece y se muestra la pantalla en la que estaba el usuario

### Requirement: MOB-17 URL de la API configurable para desarrollo local
La app SHALL obtener la URL base de la API de la configuración del proyecto, sin cambios de código, para poder apuntar desde Expo Go o un simulador a la API local mediante la IP de la red local. El README del proyecto MUST documentar cómo configurarla y cómo ver los OTP en Mailpit.

#### Scenario: Apuntar a la API local
- **WHEN** se configura la URL de la API con la IP de la red local y se inicia la app en Expo Go
- **THEN** las peticiones de la app llegan a la API local sin modificar el código

#### Scenario: Configuración ausente
- **WHEN** la app se inicia sin URL de la API configurada
- **THEN** la app muestra un error de configuración claro en lugar de fallar en silencio
