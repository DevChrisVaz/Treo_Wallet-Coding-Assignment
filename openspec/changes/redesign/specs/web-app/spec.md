## ADDED Requirements

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
En la forma de *dashboard*, la web SHALL mostrar una navegación lateral con el Wordmark, los destinos Inicio, Movimientos, Transferir y Beneficiarios con su icono, y abajo el usuario con "Cerrar sesión"; y una barra superior con el título de la página y "Nueva transferencia" como acción principal. El destino actual MUST marcarse con `aria-current="page"`. Sustituye la navegación de encabezado vigente.

#### Scenario: Destino actual
- **WHEN** el usuario está en Movimientos en escritorio
- **THEN** el destino Movimientos de la navegación lateral tiene `aria-current="page"` y el estilo de destino actual

#### Scenario: Cerrar sesión desde el dashboard
- **WHEN** el usuario elige "Cerrar sesión" en la navegación lateral
- **THEN** se cierra la sesión como indica WEB-05

### Requirement: WEB-27 Navegación de la app en teléfono
En la forma de app, la web SHALL mostrar una barra de pestañas con Inicio, Movimientos, Transferir y Beneficiarios, y un encabezado con un avatar que abre el menú de la cuenta con "Cerrar sesión". Durante el flujo de transferencia la barra de pestañas MUST ocultarse.

#### Scenario: Pestañas en teléfono
- **WHEN** se abre Movimientos a 390 px
- **THEN** la barra de pestañas muestra las cuatro pestañas y Movimientos está marcada como actual

#### Scenario: Flujo de transferencia a pantalla completa
- **WHEN** el usuario entra al flujo de transferencia a 390 px
- **THEN** no se ve la barra de pestañas y el flujo ocupa la pantalla

### Requirement: WEB-28 Inicio rediseñado
Inicio SHALL mostrar un *hero* con el saldo total de las cuentas, lo que queda del límite diario y acciones rápidas (al menos Transferir y Ver movimientos); las cuentas como tarjetas seleccionables; el medidor del límite diario; y los últimos 5 movimientos de la cuenta seleccionada con "Ver todos", que abre Movimientos con esa cuenta. Amplía WEB-13.

#### Scenario: Saldo total
- **WHEN** el usuario tiene Principal con $25,000.00 y Ahorro con $10,000.00
- **THEN** el *hero* muestra $35,000.00 sumado sin punto flotante

#### Scenario: Cambiar de cuenta
- **WHEN** el usuario selecciona la tarjeta de Ahorro
- **THEN** la tarjeta queda marcada como seleccionada y la lista muestra los últimos 5 movimientos de Ahorro

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
