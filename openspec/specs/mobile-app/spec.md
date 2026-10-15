# mobile-app Specification

## Purpose

App móvil de la billetera (alcance reducido del enunciado): permite iniciar sesión, consultar el saldo y los últimos movimientos, y enviar transferencias a beneficiarios ya registrados de forma segura aunque la red sea inestable, sin perder ni duplicar dinero.

## Requirements

### Requirement: MOB-01 Inicio de sesión
La app SHALL permitir iniciar sesión con email y contraseña contra la API y, al tener éxito, SHALL llevar al usuario a la pantalla de saldo. La app MUST mostrar el mismo mensaje genérico para cualquier credencial inválida y MUST NOT ofrecer registro ni verificación de correo; un usuario con el correo sin verificar SHALL ver un mensaje que le indica completar la verificación en la web.

#### Scenario: Credenciales válidas
- **WHEN** el usuario envía un email y una contraseña correctos de una cuenta verificada
- **THEN** la app guarda la sesión y muestra la pantalla de saldo

#### Scenario: Credenciales inválidas
- **WHEN** la API responde `401` con `code` `INVALID_CREDENTIALS`
- **THEN** la app muestra "El correo o la contraseña no coinciden." (mensaje de `INVALID_CREDENTIALS` del paquete de diseño) sin indicar cuál de los dos falló
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
- **AND** muestra la pantalla de inicio de sesión con el mensaje "Cerramos tu sesión por seguridad. Inicia sesión de nuevo." (mensaje de `SESSION_REVOKED` del paquete de diseño)

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
La app SHALL mostrar los últimos 20 movimientos de la cuenta que el usuario elija, del más reciente al más antiguo, con su tipo, concepto, contraparte, monto con signo y saldo resultante, y con su referencia solo cuando el movimiento la tiene (nunca "null" ni una referencia vacía). La pantalla MUST tener estados de carga, vacío y error.

#### Scenario: Cuenta con movimientos
- **WHEN** el usuario abre una cuenta con más de 20 movimientos
- **THEN** la app muestra exactamente los 20 más recientes, ordenados del más reciente al más antiguo

#### Scenario: Salidas y entradas
- **WHEN** la lista incluye un movimiento `TRANSFER_OUT` de `"-150.00"` y un `DEPOSIT` de `"25000.00"`
- **THEN** la app muestra la salida como "−$150.00" (signo menos U+2212, con el color de la tinta y no el de error) con la etiqueta "Transferencia enviada" y la entrada como "+$25,000.00" (con el color de dinero entrante) con la etiqueta "Depósito"

#### Scenario: Cuenta sin movimientos
- **WHEN** la cuenta no tiene movimientos
- **THEN** la app muestra un estado vacío que lo indica

#### Scenario: Movimiento sin referencia
- **WHEN** un movimiento trae `reference` igual a `null`
- **THEN** su renglón muestra solo la fecha u hora, sin "Ref." ni "null"

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
La app SHALL pedir la cuenta de origen, el monto, el concepto y la referencia opcional, y MUST validarlos con las mismas reglas del contrato antes de enviarlos: monto mayor que 0 con un máximo de 2 decimales y 12 dígitos enteros, concepto de 1 a 40 caracteres sin espacios al inicio ni al final y, si se indica, referencia de 1 a 7 dígitos. Mientras se escribe o se pega, el campo de monto MUST admitir solo dígitos y un punto con un máximo de 2 decimales y mostrarse con separadores de miles (`12,345.67`); la app MUST enviar el monto como string decimal sin separadores, sin convertirlo a número de punto flotante ni redondearlo. El campo de referencia MUST llamarse "Referencia (opcional)", admitir solo dígitos con un máximo de 7 y usar teclado numérico; si queda vacío, la petición MUST omitirla y la revisión MUST NOT mostrar la fila de referencia.

#### Scenario: Monto con más de dos decimales (redondeo)
- **WHEN** el usuario captura el monto `100.005`
- **THEN** el campo conserva `100.00` y la app no redondea el monto a `100.01`

#### Scenario: Letras y símbolos en el monto
- **WHEN** el usuario escribe o pega `"12a,345.678"` en el monto
- **THEN** el campo muestra `12,345.67` y la petición lleva `"12345.67"`

#### Scenario: Monto válido sin centavos
- **WHEN** el usuario captura el monto `1250`
- **THEN** la app lo acepta y lo envía como el string `"1250"`

#### Scenario: Monto cero
- **WHEN** el usuario captura el monto `0.00`
- **THEN** la app muestra un error indicando que el monto debe ser mayor que 0

#### Scenario: Referencia no numérica
- **WHEN** el usuario escribe o pega la referencia `12A45`
- **THEN** el campo queda en `1245`

#### Scenario: Sin referencia
- **WHEN** el usuario deja la referencia vacía y envía la transferencia
- **THEN** la petición no lleva `reference` y la revisión no muestra la fila de referencia

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
Cuando la transferencia queda en `PENDING_OTP`, la app SHALL pedir el código de 6 dígitos enviado por correo, mostrando el correo enmascarado, el tiempo restante y los intentos que quedan. El campo del código MUST admitir solo dígitos con un máximo de 6, también al pegar, y usar teclado numérico. La app SHALL permitir reenviar el código mientras queden reenvíos. La confirmación MUST reintentarse ante pérdida de red igual que la creación, ya que la API la trata como idempotente por estado.

#### Scenario: Código correcto
- **WHEN** el usuario envía el código correcto antes de que venza
- **THEN** la app muestra el resultado con estado `COMPLETED`

#### Scenario: Solo dígitos
- **WHEN** el usuario escribe o pega `"12ab3456789"` en el campo del código
- **THEN** el campo queda en `"123456"`

#### Scenario: Código incorrecto
- **WHEN** la confirmación responde `422` con `code` `OTP_INVALID` y `attemptsRemaining` igual a 1
- **THEN** la app muestra "El código no es correcto. Te queda 1 intento." (mensaje de `OTP_INVALID` del paquete de diseño más los intentos) y conserva la pantalla del código

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
Al terminar un intento, la app SHALL mostrar el estado que devolvió la API: un comprobante para `COMPLETED` con monto, beneficiario, concepto, referencia (solo si la transferencia la tiene), fecha e identificador de la transferencia, o el motivo para `REJECTED`, `FAILED` o `EXPIRED`. Los datos del comprobante MUST provenir de la respuesta de la API y no de lo que capturó el usuario.

#### Scenario: Comprobante
- **WHEN** la API devuelve una transferencia `COMPLETED` con referencia
- **THEN** la app muestra el comprobante con el monto devuelto por la API formateado en `es-MX`, el beneficiario, el concepto, la referencia, la fecha y el identificador

#### Scenario: Comprobante sin referencia
- **WHEN** la API devuelve una transferencia `COMPLETED` con `reference` igual a `null`
- **THEN** el comprobante no muestra la fila de referencia ni escribe "null"

#### Scenario: Saldos actualizados después de transferir
- **WHEN** el usuario vuelve a la pantalla de saldo después de una transferencia `COMPLETED`
- **THEN** la app muestra los saldos consultados de nuevo a la API

### Requirement: MOB-14 Mensajes de error por código
La app SHALL decidir el mensaje que muestra a partir del `code` del problema RFC 9457 y nunca a partir de `type`, `title` o `detail`. Ante un `code` desconocido o un error interno, la app MUST mostrar un mensaje genérico con el `requestId` para soporte y MUST NOT mostrar detalles técnicos.

#### Scenario: Saldo insuficiente
- **WHEN** la API responde `422` con `code` `INSUFFICIENT_FUNDS`
- **THEN** la app muestra "No tienes saldo suficiente para esta transferencia." (mensaje de `INSUFFICIENT_FUNDS` del paquete de diseño, DSG-12)

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

### Requirement: MOB-18 Navegación por pestañas
La app SHALL navegar con una barra de pestañas inferior con Inicio, Movimientos y Transferir, con su icono y la pestaña actual marcada, y un encabezado con un avatar que abre el menú de la cuenta con "Cerrar sesión". Durante el flujo de transferencia la barra de pestañas MUST ocultarse. Sustituye la navegación por pila vigente para estos destinos.

#### Scenario: Pestaña actual
- **WHEN** el usuario toca la pestaña Movimientos
- **THEN** se abre Movimientos y la pestaña queda marcada como seleccionada para los lectores de pantalla

#### Scenario: Cerrar sesión desde el avatar
- **WHEN** el usuario elige "Cerrar sesión" en el menú del avatar
- **THEN** se cierra la sesión como indica MOB-04

#### Scenario: Flujo a pantalla completa
- **WHEN** el usuario toca la pestaña Transferir
- **THEN** el flujo de transferencia ocupa la pantalla y la barra de pestañas no se ve

### Requirement: MOB-19 Inicio rediseñado
Inicio SHALL mostrar el saludo con el nombre del usuario, un *hero* con el saldo total de las cuentas, lo que queda del límite diario y acciones rápidas (al menos Transferir, Recibir y Ver movimientos, en ese orden), las cuentas como tarjetas seleccionables con la CLABE enmascarada (solo los últimos 4 dígitos; la completa solo se ve en "Recibir dinero", MOB-28), el medidor del límite diario y los últimos 5 movimientos de la cuenta seleccionada con "Ver todos", que abre Movimientos con esa cuenta. Amplía MOB-05.

#### Scenario: Saldo total
- **WHEN** el usuario tiene Principal con $25,000.00 y Ahorro con $10,000.00
- **THEN** el *hero* muestra $35,000.00 sumado sin punto flotante

#### Scenario: Ver todos
- **WHEN** el usuario toca "Ver todos" con la cuenta Ahorro seleccionada
- **THEN** se abre Movimientos con Ahorro seleccionada

#### Scenario: Acción Recibir y CLABE enmascarada
- **WHEN** el usuario abre Inicio
- **THEN** las acciones rápidas muestran "Recibir" después de "Transferir"
- **AND** las tarjetas de cuenta muestran solo la CLABE enmascarada

### Requirement: MOB-20 Movimientos como pestaña
Movimientos SHALL ser una pestaña con un selector de cuenta y la lista de los últimos 20 movimientos de la cuenta seleccionada (MOB-06) agrupada por día de Ciudad de México con encabezados "Hoy", "Ayer" o la fecha corta. Amplía MOB-06.

#### Scenario: Cambio de cuenta
- **WHEN** el usuario cambia de Principal a Ahorro en el selector
- **THEN** la lista muestra los últimos 20 movimientos de Ahorro agrupados por día

#### Scenario: Movimiento cerca de la medianoche
- **WHEN** un movimiento ocurrió a las 05:30 UTC de hoy
- **THEN** aparece bajo "Ayer", porque en Ciudad de México fue a las 23:30 del día anterior

### Requirement: MOB-21 Flujo de transferencia por pasos
El flujo SHALL seguir los pasos Destinatario (beneficiarios registrados), Monto y concepto, Revisión, Código (cuando la transferencia lo requiera) y Comprobante, con un indicador del paso actual y el monto como protagonista del paso de monto. Los comportamientos de MOB-07 a MOB-14 MUST conservarse, incluidos el envío único, el reintento con la misma llave ante pérdida de red y el estado incierto.

#### Scenario: Indicador de pasos
- **WHEN** el usuario está en el paso de código
- **THEN** el indicador muestra el paso 4 de 5 y lo anuncia a los lectores de pantalla

#### Scenario: Pérdida de red al enviar
- **WHEN** se pierde la red al tocar "Enviar" en la revisión
- **THEN** la app reintenta con la misma llave y muestra el estado de reintento, como indica MOB-10

### Requirement: MOB-22 Inicio de sesión de marca
El inicio de sesión SHALL mostrarse sobre la superficie de marca (verde profundo con el Wordmark) con el formulario en una hoja blanca inferior. Amplía MOB-01.

#### Scenario: Pantalla de inicio de sesión
- **WHEN** se abre la app sin sesión
- **THEN** se ve la superficie de marca con el Wordmark y el formulario en una hoja blanca con los campos de MOB-01

### Requirement: MOB-23 Estados de las programadas en la app
La app SHALL usar el contrato 1.3.0 y el paquete de diseño con los estados `SCHEDULED` y `CANCELLED`. Si recibe una transferencia en uno de esos estados, SHALL mostrarla con la etiqueta y el tono del paquete de diseño, sin tratarla como error. `scheduledFor` es un instante: si la app llegara a mostrarlo, MUST mostrar la fecha y la hora en la Ciudad de México. La app MUST NOT ofrecer programar ni cancelar transferencias: esas funciones son solo de la web en este alcance. Amplía MOB-13.

#### Scenario: Transferencia programada en el resultado
- **WHEN** la app muestra el resultado de una transferencia cuyo estado es `SCHEDULED`
- **THEN** la insignia dice "Programada" con el tono informativo y no se muestra un mensaje de error

#### Scenario: Sin opción de programar
- **WHEN** el usuario abre el flujo de transferencia en la app
- **THEN** no existe ningún control para elegir una fecha ni una hora de envío

### Requirement: MOB-24 Activación opcional del desbloqueo biométrico
Después de un inicio de sesión exitoso con contraseña, si el dispositivo tiene hardware biométrico con al menos una biometría registrada y el usuario no ha respondido antes en ese dispositivo, la app SHALL ofrecer activar el desbloqueo con el nombre del tipo disponible ("huella", "rostro" o "biometría").

- **"Activar"** MUST pedir la autenticación biométrica y activar el desbloqueo solo si tiene éxito.
- **"Ahora no"** MUST guardar esa respuesta y no volver a ofrecerlo hasta el siguiente inicio de sesión con contraseña después de cerrar sesión.
- **Interruptor:** la pantalla de inicio SHALL tener un interruptor "Desbloqueo con <tipo>". Activarlo exige la autenticación biométrica; desactivarlo no.
- **Sin biometría registrada:** la app MUST NOT ofrecer el desbloqueo y el interruptor MUST aparecer deshabilitado con una explicación.
- **Preferencia:** MUST guardarse en el almacenamiento seguro del sistema y MUST NOT contener tokens ni datos biométricos.

Amplía MOB-01 y MOB-02.

#### Scenario: Ofrecer el desbloqueo
- **WHEN** Ana inicia sesión con contraseña en un Android con una huella registrada
- **THEN** la app ofrece "Entrar con tu huella" con las opciones "Activar" y "Ahora no"

#### Scenario: Activación exitosa
- **WHEN** Ana pulsa "Activar" y la autenticación biométrica tiene éxito
- **THEN** el desbloqueo queda activo y el interruptor de la pantalla de inicio aparece encendido

#### Scenario: Activación cancelada
- **WHEN** Ana pulsa "Activar" y cancela el diálogo biométrico
- **THEN** el desbloqueo queda inactivo

#### Scenario: Ahora no
- **WHEN** Ana pulsa "Ahora no", cierra la app y la vuelve a abrir con la sesión guardada
- **THEN** la app no vuelve a ofrecer el desbloqueo

#### Scenario: Sin biometría registrada
- **WHEN** Ana inicia sesión en un dispositivo sin biometría registrada
- **THEN** la app no ofrece el desbloqueo y el interruptor aparece deshabilitado con una explicación

### Requirement: MOB-25 Bloqueo al abrir y al volver de segundo plano
Con el desbloqueo activo y un refresh token guardado, la app SHALL pedir la autenticación biométrica en dos momentos:
- al abrirse en frío, antes de restaurar la sesión con la API (MOB-02) y antes de mostrar cualquier saldo;
- al volver a estar activa después de 60 segundos o más en segundo plano.

Una ausencia menor a 60 segundos MUST NOT pedirla.

Mientras no se desbloquea, la app MUST mostrar una pantalla de bloqueo con dos botones: "Desbloquear con <tipo>" (por ejemplo, "Desbloquear con huella"), que vuelve a pedir la biometría, y "Usar mi contraseña". La pantalla MUST NOT mostrar saldos, movimientos ni datos personales. La pantalla de privacidad (MOB-16) MUST mantenerse hasta que la pantalla de bloqueo la sustituya. Si el usuario cancela el diálogo biométrico, la app MUST quedarse en la pantalla de bloqueo sin volver a abrir el diálogo por su cuenta.

#### Scenario: Apertura en frío con desbloqueo activo
- **WHEN** Ana abre la app con el desbloqueo activo y una sesión guardada
- **THEN** la app pide la huella antes de hacer cualquier petición de renovación a la API
- **AND** tras autenticarse, restaura la sesión y muestra sus saldos

#### Scenario: Regreso rápido
- **WHEN** Ana manda la app a segundo plano y vuelve a los 30 segundos
- **THEN** la app no pide la huella y muestra la pantalla en la que estaba

#### Scenario: Regreso después de un minuto
- **WHEN** Ana vuelve a la app después de 90 segundos en segundo plano
- **THEN** la app muestra la pantalla de bloqueo y pide la huella antes de mostrar saldos

#### Scenario: Diálogo cancelado
- **WHEN** Ana cancela el diálogo biométrico
- **THEN** la app sigue en la pantalla de bloqueo con "Desbloquear con huella" y "Usar mi contraseña", sin mostrar saldos

#### Scenario: Desbloqueo inactivo
- **WHEN** Ana abre la app con el desbloqueo inactivo y una sesión guardada
- **THEN** la app restaura la sesión sin pedir biometría, como en MOB-02

### Requirement: MOB-26 Alternativas al desbloqueo biométrico
El diálogo biométrico SHALL aceptar como alternativa la credencial del dispositivo (PIN, patrón o contraseña).

- **"Usar mi contraseña":** MUST cerrar la sesión como en MOB-04 (revocar el refresh token y borrar los tokens aunque la API no responda), desactivar el desbloqueo y mostrar el inicio de sesión.
- **Biometría retirada o sin credencial del dispositivo:** si al pedir el desbloqueo el dispositivo ya no tiene biometría registrada ni credencial, la app MUST desactivar el desbloqueo, cerrar la sesión y pedir la contraseña.
- **Bloqueo temporal del sistema:** si el sistema bloquea temporalmente la biometría por demasiados intentos, la app MUST mostrar un mensaje que lo explique y mantener ambas opciones.

Amplía MOB-04.

#### Scenario: Usar mi contraseña
- **WHEN** Ana pulsa "Usar mi contraseña" en la pantalla de bloqueo
- **THEN** la app pide a la API la revocación del refresh token, borra los tokens y muestra el inicio de sesión
- **AND** el desbloqueo queda inactivo

#### Scenario: Huellas retiradas del dispositivo
- **WHEN** Ana quitó todas sus huellas del dispositivo y abre la app con el desbloqueo activo
- **THEN** la app desactiva el desbloqueo, cierra la sesión y muestra el inicio de sesión

#### Scenario: Demasiados intentos
- **WHEN** el sistema responde que la biometría está bloqueada temporalmente
- **THEN** la pantalla de bloqueo muestra "Demasiados intentos. Intenta más tarde o usa tu contraseña." con ambas opciones

### Requirement: MOB-27 Desactivación del desbloqueo
Cerrar sesión (MOB-04) o una sesión revocada (MOB-03) SHALL desactivar el desbloqueo y borrar su preferencia, incluida la respuesta "Ahora no". Así, el siguiente inicio de sesión con contraseña vuelve a ofrecerlo. Desactivar el interruptor MUST borrar la preferencia sin cerrar la sesión y MUST NOT volver a mostrar la oferta de MOB-24, que solo aparece después de un inicio de sesión con contraseña.

#### Scenario: Cierre de sesión
- **WHEN** Ana, con el desbloqueo activo, cierra sesión y vuelve a iniciar sesión con contraseña
- **THEN** la preferencia se borró y la app vuelve a ofrecer el desbloqueo

#### Scenario: Sesión revocada
- **WHEN** la renovación responde `401 SESSION_REVOKED` con el desbloqueo activo
- **THEN** la app borra los tokens y la preferencia y muestra el inicio de sesión

#### Scenario: Apagar el interruptor
- **WHEN** Ana apaga el interruptor y luego cierra y abre la app
- **THEN** la app restaura la sesión sin pedir biometría

### Requirement: MOB-28 Recibir dinero
Inicio SHALL ofrecer la acción rápida "Recibir" (con una flecha entrante), después de "Transferir", que abre la hoja "Recibir dinero". La hoja MUST ofrecer arriba un selector de las cuentas del usuario, con la cuenta elegida en Inicio preseleccionada, y MUST mostrar los datos de la cuenta elegida: "Titular" (el nombre completo del usuario), "Banco" ("TreoWallet"), "Cuenta" (el nombre de la cuenta) y "CLABE" completa en grupos de 4 dígitos, junto a la indicación "Comparte estos datos para que te transfieran desde otra cuenta TreoWallet.". "Copiar CLABE" MUST copiar los 18 dígitos sin espacios y mostrar "CLABE copiada"; "Compartir" MUST abrir la hoja nativa para compartir con los mismos datos. Esta es la única pantalla de la app que muestra la CLABE completa.

#### Scenario: Abrir Recibir
- **WHEN** el usuario está en Inicio con "Ahorro" seleccionada y toca "Recibir"
- **THEN** se abre "Recibir dinero" con "Ahorro" preseleccionada, con Titular, Banco, Cuenta y la CLABE en grupos de 4 dígitos

#### Scenario: Cambiar de cuenta
- **WHEN** el usuario elige "Principal" en el selector
- **THEN** la hoja muestra la cuenta y la CLABE de "Principal"

#### Scenario: Copiar la CLABE
- **WHEN** el usuario toca "Copiar CLABE"
- **THEN** el portapapeles recibe los 18 dígitos sin espacios y el botón dice "CLABE copiada"

#### Scenario: Compartir
- **WHEN** el usuario toca "Compartir"
- **THEN** se abre la hoja nativa para compartir con el titular, el banco, la cuenta y la CLABE

### Requirement: MOB-29 Búsqueda de beneficiarios
El paso de destinatario del flujo de transferencia SHALL ofrecer, arriba de la lista de beneficiarios registrados, un campo de búsqueda con una lupa al inicio, el texto de ayuda "Buscar por nombre, alias o CLABE" y un botón × que lo vacía cuando tiene texto. El filtro MUST hacerse en el cliente: sin distinguir mayúsculas ni acentos por nombre y alias, y por contener los dígitos escritos en la CLABE cuando la consulta son solo dígitos. Sin coincidencias, la app MUST mostrar "Sin resultados" con la acción "Limpiar búsqueda", que vacía el campo y devuelve la lista. Sin beneficiarios, el campo MUST NOT mostrarse. Amplía MOB-07.

#### Scenario: Filtrar por nombre o alias
- **WHEN** el usuario escribe `"nunez"` y tiene a "Luis Pérez Núñez" y a "Ana Gómez"
- **THEN** la lista muestra solo a "Luis Pérez Núñez"

#### Scenario: Filtrar por CLABE
- **WHEN** el usuario escribe dígitos que están dentro de la CLABE de un beneficiario
- **THEN** la lista muestra solo a los beneficiarios cuya CLABE los contiene

#### Scenario: Sin coincidencias
- **WHEN** el usuario escribe `"zzz"`
- **THEN** la app muestra "Sin resultados" y "Limpiar búsqueda", que restaura la lista completa

#### Scenario: Borrar la búsqueda
- **WHEN** el usuario toca el botón × del campo
- **THEN** el campo queda vacío y la lista muestra a todos los beneficiarios

#### Scenario: Sin beneficiarios
- **WHEN** el usuario no tiene beneficiarios
- **THEN** no se muestra el campo de búsqueda

### Requirement: MOB-30 Registro en revisión al iniciar sesión
Si el inicio de sesión responde `403 REGISTRATION_IN_REVIEW` (IDN-08), la app SHALL mostrar el mensaje de `REGISTRATION_IN_REVIEW` del paquete de diseño y MUST NOT guardar ninguna sesión ni llevar a otra pantalla.

#### Scenario: Usuario en revisión
- **WHEN** la API responde `403` con `code` `REGISTRATION_IN_REVIEW` al iniciar sesión
- **THEN** la app muestra "Tu registro está en revisión. Te escribiremos a tu correo cuando terminemos." en la pantalla de inicio de sesión
- **AND** no guarda ningún token
