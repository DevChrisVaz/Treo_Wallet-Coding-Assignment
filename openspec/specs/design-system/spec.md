# design-system Specification

## Purpose

Define la base visual y de contenido de TreoWallet (tokens, convenciones de dinero y estados, textos e inventario de componentes) que la web y la app móvil consumen desde un paquete independiente, para que ambas se vean, se comporten y hablen igual.

## Requirements

### Requirement: DSG-01 Paquete de tokens como fuente única
El sistema de diseño SHALL distribuirse como un paquete independiente que la web y la app móvil instalan como artefacto (copia, no enlace simbólico), sin credenciales de registro y sin dependencias de runtime. Ningún cliente MUST definir colores, tamaños tipográficos, espaciados ni radios propios fuera de los que exporta el paquete.

#### Scenario: Instalación en un cliente
- **WHEN** un cliente instala el paquete desde la carpeta local con `install-links=true` y sin token
- **THEN** recibe una copia del paquete que funciona sin instalar ninguna dependencia de runtime

#### Scenario: Valores fuera del sistema
- **WHEN** se revisa el código de estilos de la web o de la app móvil
- **THEN** los colores, tamaños, espaciados y radios provienen de los tokens del paquete

### Requirement: DSG-02 Identidad visual basada en Treo
El sistema SHALL tomar de treo.mx su paleta (verde profundo `#1C4B42` para acciones, lima `#B4E717` para el estado activo, tinta `#001A05`, verde de marca `#31C454`, superficies `#FFFFFF`, `#EDF7ED` y `#F6F5F2`), su tipografía (Work Sans) y su forma (botones en píldora y tarjetas con radio de 9 px). El nombre de la app MUST mostrarse como el logotipo de texto "TreoWallet" y MUST NOT incluir logotipos ni archivos de fuentes de Treo.

#### Scenario: Acción principal
- **WHEN** se renderiza un botón principal en reposo
- **THEN** su fondo es `#1C4B42`, su texto es blanco y su forma es de píldora

#### Scenario: Acción principal activa
- **WHEN** el botón principal está en hover (web) o presionado (móvil)
- **THEN** su fondo es `#B4E717` y su texto es `#1C4B42`

### Requirement: DSG-03 Tokens semánticos
Los componentes SHALL usar solo tokens semánticos por rol (superficie, texto, acción, borde, acento, estado y dinero) y MUST NOT referenciar directamente los colores primitivos de la paleta. El verde de marca `#31C454` MUST usarse solo como acento decorativo o de indicador, nunca como color de texto.

#### Scenario: Componente con color primitivo
- **WHEN** un componente necesita el color de error
- **THEN** usa el token semántico de estado de error y no el valor hexadecimal

#### Scenario: Verde de marca como texto
- **WHEN** se revisan los tokens de texto del tema
- **THEN** ninguno tiene el valor `#31C454`

### Requirement: DSG-04 Contraste accesible verificado
Cada combinación de texto y superficie que declara el sistema SHALL tener una relación de contraste de al menos 4.5:1 (WCAG AA para texto normal), y los límites de componentes de interfaz (borde de los campos, anillo de foco) MUST tener al menos 3:1 contra la superficie. El contraste MUST verificarse con pruebas automáticas que fallan si una combinación queda por debajo.

#### Scenario: Gris de Treo
- **WHEN** se evalúa el gris `#7E7E7E` de Treo como texto sobre blanco
- **THEN** su contraste de 4.06:1 no cumple y el sistema usa en su lugar un texto secundario de al menos 4.5:1

#### Scenario: Regresión de contraste
- **WHEN** alguien cambia un token de texto a un valor con contraste menor a 4.5:1 contra su superficie
- **THEN** la prueba de contraste falla e identifica la combinación

### Requirement: DSG-05 Tipografía
El sistema SHALL usar Work Sans en pesos 400, 500 y 600 con una escala fija (display, encabezados de tres niveles, cuerpo, cuerpo pequeño, etiqueta y leyenda), con un tamaño mínimo de 12 px y con pilas de fuentes de respaldo. Las cifras de montos MUST mostrarse con dígitos tabulares para que se alineen en columnas.

#### Scenario: Leyenda mínima
- **WHEN** se revisa la escala tipográfica
- **THEN** ningún tamaño es menor que 12 px

#### Scenario: Fuente no disponible
- **WHEN** Work Sans no carga
- **THEN** el texto se muestra con la pila de respaldo y sigue siendo legible

### Requirement: DSG-06 Espaciado, forma, foco y movimiento
El sistema SHALL definir un espaciado de base 4 px, radios (pequeño 6 px, mediano 9 px, grande 16 px y píldora), un anillo de foco visible de 2 px con separación, un área táctil mínima de 44 px y duraciones de animación cortas. Cuando el usuario prefiere movimiento reducido, las animaciones MUST desactivarse.

#### Scenario: Foco con teclado
- **WHEN** un control recibe foco con el teclado en la web
- **THEN** muestra el anillo de foco del sistema, con al menos 3:1 de contraste contra la superficie

#### Scenario: Movimiento reducido
- **WHEN** el sistema operativo indica movimiento reducido
- **THEN** los esqueletos de carga y las transiciones no se animan

### Requirement: DSG-07 Tema claro listo para tema oscuro
El sistema SHALL entregar únicamente el tema claro, con los tokens semánticos agrupados por tema, de modo que agregar un tema oscuro requiera solo un nuevo juego de valores. En la web, los tokens MUST exponerse como variables CSS en `:root`, para que un tema futuro las redefina sin cambiar los componentes.

#### Scenario: Tema futuro
- **WHEN** se agrega un juego de valores para un tema oscuro
- **THEN** ningún componente necesita cambios, porque todos referencian tokens semánticos

### Requirement: DSG-08 Salidas por plataforma desde una sola fuente
Los tokens SHALL definirse una sola vez y generarse para cada plataforma: un módulo TypeScript, una hoja de variables CSS con la definición de tema para Tailwind v4 (web) y un tema para React Native con el nombre de la familia tipográfica por peso (móvil). Los archivos generados que se versionan MUST coincidir con los que produce la fuente vigente.

#### Scenario: Mismo valor en todas las salidas
- **WHEN** se lee el token de acción principal en el módulo TypeScript, en la hoja CSS y en el tema de React Native
- **THEN** las tres salidas tienen el mismo valor

#### Scenario: Salida desactualizada
- **WHEN** alguien cambia un token en la fuente sin regenerar la hoja CSS
- **THEN** la verificación del paquete falla indicando que la salida está desactualizada

### Requirement: DSG-09 Convenciones de dinero
Los montos SHALL mostrarse con el formato de `formatMXN` del contrato y con dígitos tabulares. Una entrada de dinero MUST mostrarse con el token de dinero entrante y el signo `+`; una salida MUST mostrarse con el token de dinero saliente (la tinta) y el signo menos `−` (U+2212). Una salida MUST NOT mostrarse con el color de error.

#### Scenario: Transferencia recibida
- **WHEN** se muestra un movimiento de tipo transferencia recibida por 150.00
- **THEN** se ve como `+$150.00` con el color de dinero entrante

#### Scenario: Transferencia enviada
- **WHEN** se muestra un movimiento de tipo transferencia enviada por 150.00
- **THEN** se ve como `−$150.00` con el color de la tinta, no con el de error

### Requirement: DSG-10 Estados de transferencia y tipos de movimiento
El paquete SHALL exportar como datos el tono y la etiqueta de cada estado de transferencia (`PENDING_OTP`, `COMPLETED`, `REJECTED`, `FAILED`, `EXPIRED`) y la etiqueta y la dirección de cada tipo de movimiento (`DEPOSIT`, `TRANSFER_IN`, `TRANSFER_OUT`, `OWN_TRANSFER_IN`, `OWN_TRANSFER_OUT`), para que ambos clientes los muestren igual.

#### Scenario: Transferencia pendiente
- **WHEN** se muestra una transferencia en `PENDING_OTP`
- **THEN** su insignia usa el tono de aviso y la etiqueta "Pendiente de código"

#### Scenario: Traspaso entre cuentas propias
- **WHEN** se muestra un movimiento `OWN_TRANSFER_OUT`
- **THEN** su etiqueta es "Traspaso enviado" y su dirección es salida

### Requirement: DSG-11 Inventario de componentes
El sistema SHALL especificar los componentes que ambos clientes implementan con sus tokens (botón, campo de texto, campo de monto, campo de código de un solo uso, selector, tarjeta de cuenta, fila de movimiento, insignia de estado, alerta, estado vacío, esqueleto de carga, comprobante, medidor del límite diario y logotipo), con sus variantes, estados y reglas de accesibilidad. La app móvil MUST además implementar la pantalla de privacidad para segundo plano con la superficie de marca y el logotipo.

#### Scenario: Campo con error
- **WHEN** un campo de texto tiene un error de validación
- **THEN** muestra el mensaje debajo con el tono de error, asociado al campo para los lectores de pantalla

#### Scenario: Botón enviando
- **WHEN** un botón principal está en estado de envío
- **THEN** se deshabilita, conserva su tamaño y anuncia que la acción está en curso

### Requirement: DSG-12 Textos de la interfaz
El paquete SHALL exportar en español de México, con un tono cercano que habla de "tú", el mensaje para cada `ProblemCode` del contrato y las etiquetas de estados y movimientos. Cada mensaje de error MUST explicar qué pasó y, cuando aplique, qué hacer, sin disculpas ni términos técnicos.

#### Scenario: Saldo insuficiente
- **WHEN** un cliente muestra el error `INSUFFICIENT_FUNDS`
- **THEN** el texto es "No tienes saldo suficiente para esta transferencia."

#### Scenario: Código desconocido
- **WHEN** un cliente recibe un `code` que el paquete no conoce
- **THEN** muestra el mensaje de `INTERNAL_ERROR`

#### Scenario: Registro en revisión
- **WHEN** un cliente muestra el error `REGISTRATION_IN_REVIEW`
- **THEN** el texto es "Tu registro está en revisión. Te escribiremos a tu correo cuando terminemos."

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

### Requirement: DSG-18 Estados y textos de las transferencias programadas
El paquete SHALL exportar, como datos y con las mismas reglas de DSG-10 y DSG-12:
- el tono y la etiqueta de `SCHEDULED`: tono informativo, "Programada";
- el tono y la etiqueta de `CANCELLED`: tono neutro, "Cancelada";
- los mensajes de los códigos `TRANSFER_NOT_CANCELLABLE` y `SCHEDULED_LIMIT_REACHED`.

La lista de estados del paquete MUST cubrir todos los valores de `TransferStatus` del contrato 1.2.0. El paquete MUST publicarse como versión menor. Amplía DSG-10 y DSG-12.

#### Scenario: Transferencia programada
- **WHEN** se muestra una transferencia en `SCHEDULED`
- **THEN** su insignia usa el tono informativo y la etiqueta "Programada"

#### Scenario: Transferencia cancelada
- **WHEN** se muestra una transferencia en `CANCELLED`
- **THEN** su insignia usa el tono neutro y la etiqueta "Cancelada"

#### Scenario: Tope de programadas
- **WHEN** un cliente muestra el error `SCHEDULED_LIMIT_REACHED`
- **THEN** el mensaje es "Llegaste al máximo de 20 transferencias programadas. Cancela alguna para programar otra."

#### Scenario: Ya no se puede cancelar
- **WHEN** un cliente muestra el error `TRANSFER_NOT_CANCELLABLE`
- **THEN** el mensaje es "Esta transferencia ya no se puede cancelar."
