## ADDED Requirements

### Requirement: DSG-13 Lenguaje visual elevado de la marca
El sistema SHALL conservar la identidad de DSG-02 (paleta de Treo, Work Sans, botones en píldora) y SHALL definir además un lienzo cálido para el fondo de la app con el contenido en tarjetas blancas elevadas, una superficie de *hero* en verde profundo para el saldo y radio de 16 px para las superficies grandes (*hero*, hojas inferiores y paneles). Las tarjetas pequeñas MUST conservar el radio de 9 px. Amplía DSG-02 y sustituye, para las superficies grandes, el radio de DSG-06.

#### Scenario: Fondo de la app
- **WHEN** se renderiza cualquier pantalla con sesión en web o en móvil
- **THEN** el fondo es el token de lienzo (`#F6F5F2`) y el contenido va en tarjetas blancas con elevación de tarjeta

#### Scenario: Hero del saldo
- **WHEN** se renderiza el *hero* del saldo
- **THEN** su superficie es `#1C4B42`, su radio es de 16 px y el saldo usa el estilo tipográfico de display mayor

### Requirement: DSG-14 Lima solo sobre superficies oscuras
El lima de la marca SHALL usarse solo sobre superficies oscuras (el verde profundo o el *hero*) como indicador, chip o estado activo, y MUST NOT usarse como color de texto sobre superficies claras. Todo texto nuevo sobre el *hero* MUST tener contraste de al menos 4.5:1. Amplía DSG-03 y DSG-04.

#### Scenario: Pares de contraste nuevos
- **WHEN** corre la prueba de contraste del paquete
- **THEN** incluye el lima y el texto atenuado del *hero* sobre `surface.hero`, y ambos cumplen al menos 4.5:1

#### Scenario: Lima sobre claro
- **WHEN** se revisan los tokens de texto y de superficie clara del tema
- **THEN** ningún token de texto sobre superficies claras tiene el valor `#B4E717`

### Requirement: DSG-15 Iconografía compartida
El sistema SHALL definir un conjunto único de iconos de línea en tres tamaños (16, 20 y 24 px) y un mapa de concepto a icono (inicio, movimientos, transferir, beneficiarios, cerrar sesión, entrada, salida, depósito, traspaso propio, éxito, error y aviso) que web y móvil MUST usar, para que un mismo concepto tenga el mismo icono en ambas plataformas. Los iconos decorativos MUST ocultarse de los lectores de pantalla y todo botón que solo tenga icono MUST tener una etiqueta accesible.

#### Scenario: Mismo icono en ambas plataformas
- **WHEN** se renderiza la pestaña de Movimientos en la web en teléfono y en la app móvil
- **THEN** ambas muestran el icono que el mapa asigna al concepto "movimientos"

#### Scenario: Botón solo con icono
- **WHEN** se analiza el botón del avatar del encabezado con una herramienta de accesibilidad
- **THEN** tiene una etiqueta accesible y su icono decorativo no se anuncia

### Requirement: DSG-16 Tokens v2 aditivos para las tres salidas
El paquete SHALL agregar los tokens de lienzo, superficie del *hero*, texto atenuado sobre el *hero*, acento sobre oscuro, display mayor, tamaños de icono y de avatar, niveles de elevación elevada y de hoja, y las medidas de layout compartidas (altura de la barra de pestañas, ancho máximo de la columna de la app, ancho de la navegación lateral, ancho máximo del contenido y punto de cambio al *dashboard*), generados para TypeScript, CSS/Tailwind y React Native desde la misma fuente. Los tokens vigentes MUST conservar su valor y su significado; si alguno cambia, el paquete MUST publicar una versión mayor. Amplía DSG-08.

#### Scenario: Mismo valor en las tres salidas
- **WHEN** se generan las salidas del paquete
- **THEN** cada token nuevo aparece con el mismo valor en el módulo TypeScript, en la hoja CSS y en el tema de React Native

#### Scenario: Tokens vigentes intactos
- **WHEN** se comparan los tokens vigentes antes y después del change
- **THEN** ninguno cambió de valor, o la versión del paquete es 2.0.0 y el cambio está documentado

### Requirement: DSG-17 Inventario de componentes v2
El inventario SHALL agregar la barra de pestañas, la navegación lateral (solo web), la barra superior (solo web), el encabezado de la app, el *hero* del saldo, las acciones rápidas, la sección de lista con encabezados por día, el avatar, el icono, la hoja inferior y el indicador de pasos, con sus estados y reglas de accesibilidad, y SHALL reestilar los 14 componentes vigentes conservando su API pública. Web y móvil MUST implementar la misma anatomía (orden, medidas y tokens) para cada componente compartido. Amplía DSG-11.

#### Scenario: Componente compartido con la misma anatomía
- **WHEN** se compara la barra de pestañas de la web a 390 px con la de la app móvil
- **THEN** tienen la misma altura, el mismo orden de pestañas compartidas, los mismos iconos y el mismo indicador de pestaña actual

#### Scenario: API vigente conservada
- **WHEN** una pantalla existente usa un componente reestilizado con las props de hoy
- **THEN** compila y se renderiza sin cambiar esas props

#### Scenario: Hoja inferior accesible
- **WHEN** se abre una hoja inferior y se presiona Escape (web) o el botón atrás (Android)
- **THEN** la hoja se cierra y el foco vuelve al control que la abrió
