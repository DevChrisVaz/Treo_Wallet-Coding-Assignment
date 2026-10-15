## MODIFIED Requirements

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

### Requirement: MOB-23 Estados de las programadas en la app
La app SHALL usar el contrato 1.3.0 y el paquete de diseño con los estados `SCHEDULED` y `CANCELLED`. Si recibe una transferencia en uno de esos estados, SHALL mostrarla con la etiqueta y el tono del paquete de diseño, sin tratarla como error. `scheduledFor` es un instante: si la app llegara a mostrarlo, MUST mostrar la fecha y la hora en la Ciudad de México. La app MUST NOT ofrecer programar ni cancelar transferencias: esas funciones son solo de la web en este alcance. Amplía MOB-13.

#### Scenario: Transferencia programada en el resultado
- **WHEN** la app muestra el resultado de una transferencia cuyo estado es `SCHEDULED`
- **THEN** la insignia dice "Programada" con el tono informativo y no se muestra un mensaje de error

#### Scenario: Sin opción de programar
- **WHEN** el usuario abre el flujo de transferencia en la app
- **THEN** no existe ningún control para elegir una fecha ni una hora de envío

## ADDED Requirements

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
