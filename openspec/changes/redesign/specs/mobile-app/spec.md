## ADDED Requirements

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
Inicio SHALL mostrar el saludo con el nombre del usuario, un *hero* con el saldo total de las cuentas, lo que queda del límite diario y acciones rápidas (al menos Transferir y Ver movimientos), las cuentas como tarjetas seleccionables, el medidor del límite diario y los últimos 5 movimientos de la cuenta seleccionada con "Ver todos", que abre Movimientos con esa cuenta. Amplía MOB-05.

#### Scenario: Saldo total
- **WHEN** el usuario tiene Principal con $25,000.00 y Ahorro con $10,000.00
- **THEN** el *hero* muestra $35,000.00 sumado sin punto flotante

#### Scenario: Ver todos
- **WHEN** el usuario toca "Ver todos" con la cuenta Ahorro seleccionada
- **THEN** se abre Movimientos con Ahorro seleccionada

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
