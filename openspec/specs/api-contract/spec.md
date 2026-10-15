# api-contract Specification

## Purpose

Define el contrato OpenAPI de la billetera como única fuente de verdad compartida por la API, la web y la app móvil, y el paquete que lo distribuye con tipos, cliente tipado, validadores de entrada y formato de montos, sin crear dependencias de código entre proyectos.
## Requirements
### Requirement: CTR-01 Contrato OpenAPI como fuente de verdad
El paquete SHALL incluir el archivo `openapi.yaml` en formato OpenAPI 3.1 como única definición de las rutas, esquemas, códigos de error y headers de la API. El archivo MUST pasar el lint del contrato sin errores, y cada operación MUST declarar un `operationId` único y sus respuestas de error como `application/problem+json`.

#### Scenario: Contrato válido
- **WHEN** se ejecuta el lint sobre `openapi.yaml`
- **THEN** el resultado no reporta errores

#### Scenario: Errores documentados como problem+json
- **WHEN** se revisa cualquier respuesta 4xx o 5xx del contrato
- **THEN** su contenido es `application/problem+json` con el esquema `Problem`, que exige `type`, `title`, `status`, `code` y `requestId`

### Requirement: CTR-02 Versionado semántico del contrato
La versión del paquete SHALL coincidir con `info.version` del contrato. Un cambio incompatible (eliminar o renombrar una ruta, un campo requerido o un valor de enum, o endurecer una validación existente) MUST publicarse como versión mayor; agregar rutas o campos opcionales MUST publicarse como versión menor.

#### Scenario: Versión alineada
- **WHEN** se construye el paquete
- **THEN** la versión del paquete es igual a `info.version` del contrato
- **AND** si difieren, la verificación falla

#### Scenario: Cambio incompatible
- **WHEN** un cambio elimina un valor del enum `ProblemCode`
- **THEN** el cambio se publica con un incremento de versión mayor

### Requirement: CTR-03 Tipos generados desde el contrato
El paquete SHALL exportar tipos TypeScript generados a partir de `openapi.yaml` para todas las rutas, parámetros, cuerpos y respuestas. Los tipos generados versionados en el repositorio MUST coincidir con los que produce el contrato vigente.

#### Scenario: Tipos al día
- **WHEN** se regeneran los tipos a partir del contrato
- **THEN** el resultado es idéntico a los tipos versionados

#### Scenario: Tipos desactualizados
- **WHEN** alguien modifica `openapi.yaml` sin regenerar los tipos
- **THEN** la verificación del paquete falla indicando que los tipos están desactualizados

### Requirement: CTR-04 Cliente HTTP tipado por rutas
El paquete SHALL exportar una función que crea un cliente HTTP tipado por las rutas del contrato, con la URL base configurable. El cliente MUST NOT almacenar tokens: el access token se inyecta mediante una función provista por el consumidor y se envía como `Authorization: Bearer`. El cliente MUST funcionar solo con la API estándar `fetch`.

#### Scenario: Petición tipada
- **WHEN** un consumidor llama `GET /accounts` con el cliente
- **THEN** la respuesta exitosa tiene el tipo `AccountsOverview` del contrato

#### Scenario: Inyección del token
- **WHEN** el consumidor configura una función que devuelve un access token
- **THEN** cada petición autenticada incluye `Authorization: Bearer <token>`
- **AND** el cliente no guarda el token en ningún almacenamiento

#### Scenario: Ruta inexistente
- **WHEN** un consumidor intenta llamar una ruta que no existe en el contrato
- **THEN** el chequeo de tipos falla en tiempo de compilación

### Requirement: CTR-05 Request ID en cada petición
El cliente SHALL enviar el header `X-Request-Id` en cada petición. Si el consumidor provee un ID (por ejemplo, el BFF que recibió uno del navegador), el cliente MUST reutilizarlo; si no, MUST generar uno nuevo por petición.

#### Scenario: Propagación de un ID existente
- **WHEN** el consumidor provee el request ID `abc-123`
- **THEN** la petición a la API lleva `X-Request-Id: abc-123`

#### Scenario: Generación de un ID nuevo
- **WHEN** el consumidor no provee request ID
- **THEN** la petición lleva un `X-Request-Id` no vacío distinto en cada petición

### Requirement: CTR-06 Llave de idempotencia provista por el consumidor
El cliente SHALL enviar en `createTransfer` el header `Idempotency-Key` con el valor que el consumidor le entregue para ese intento. El cliente MUST NOT generar ni reemplazar la llave por su cuenta, para que los reintentos de un mismo intento usen siempre la misma llave. El paquete SHALL exportar una función que genera una llave UUID nueva, para que el consumidor la cree una sola vez por intento.

#### Scenario: Reintento con la misma llave
- **WHEN** el consumidor reintenta `createTransfer` tras un error de red pasando la misma llave
- **THEN** ambas peticiones llevan exactamente el mismo `Idempotency-Key`

#### Scenario: Llave obligatoria
- **WHEN** un consumidor intenta llamar `createTransfer` sin llave
- **THEN** el chequeo de tipos falla en tiempo de compilación

### Requirement: CTR-07 Errores problem+json como error tipado
Cuando la API responda con `application/problem+json`, el cliente SHALL entregar al consumidor un error tipado que exponga `status`, `code`, `title`, `detail`, `requestId` y las extensiones (`errors`, `transferId`, `transferStatus`, `remaining`, `attemptsRemaining`). El campo `code` MUST tiparse como la unión de los valores de `ProblemCode` del contrato. El error MUST exponer también `retryAfter`: los segundos del header `Retry-After` cuando la respuesta lo trae como entero positivo, y `undefined` en cualquier otro caso. Los fallos sin respuesta HTTP (red caída, timeout) MUST distinguirse de los errores de la API, porque son los únicos que el consumidor puede reintentar con la misma llave.

#### Scenario: Saldo insuficiente
- **WHEN** la API responde 422 con `code` `INSUFFICIENT_FUNDS` y un `transferId`
- **THEN** el consumidor recibe un error tipado con `code === "INSUFFICIENT_FUNDS"` y el `transferId`

#### Scenario: Pérdida de red
- **WHEN** la petición falla sin recibir respuesta HTTP
- **THEN** el consumidor recibe un error de red distinguible de un error de la API

#### Scenario: Respuesta de error que no es problem+json
- **WHEN** la API o un intermediario responde 502 con un cuerpo HTML
- **THEN** el consumidor recibe un error tipado con `code` `INTERNAL_ERROR` y el `status` original, sin exponer el cuerpo recibido

#### Scenario: Demasiados intentos con Retry-After
- **WHEN** la API responde 429 con `code` `RATE_LIMITED` y el header `Retry-After: 300`
- **THEN** el consumidor recibe un error tipado con `retryAfter === 300`

#### Scenario: Retry-After ausente o inválido
- **WHEN** la respuesta de error no trae `Retry-After`, o lo trae como `0`, `-5`, `1.5`, `abc` o una fecha HTTP
- **THEN** el error tipado tiene `retryAfter === undefined`

### Requirement: CTR-08 Validación de montos sin floats ni redondeo
El paquete SHALL exportar un validador de monto de entrada que acepte únicamente strings con la forma de `AmountInput` del contrato: sin signo, sin separadores, sin notación exponencial, sin espacios, sin ceros a la izquierda, con 0 a 2 decimales, con un máximo de 12 dígitos enteros y mayor que cero. Un monto válido MUST convertirse a centavos enteros sin usar aritmética de punto flotante. Un monto con más de 2 decimales MUST rechazarse; el validador MUST NOT redondearlo. Un número JSON MUST rechazarse aunque su valor sea válido.

#### Scenario: Montos aceptados
- **WHEN** se validan `"1250.50"`, `"1250.5"`, `"1250"` y `"0.01"`
- **THEN** los cuatro son válidos y se convierten a 125050, 125050, 125000 y 1 centavos respectivamente

#### Scenario: Redondeo — más de dos decimales
- **WHEN** se valida `"100.005"`
- **THEN** el monto se rechaza con un error de demasiados decimales
- **AND** no se produce ningún valor redondeado

#### Scenario: Número JSON
- **WHEN** se valida el número `1250.5` en lugar del string `"1250.5"`
- **THEN** el monto se rechaza por no ser string

#### Scenario: Formatos inválidos
- **WHEN** se validan `"0"`, `"0.00"`, `"-5.00"`, `"1,250.50"`, `"1e3"`, `" 10.00"`, `".50"`, `"007.00"` y `"9999999999999.00"`
- **THEN** todos se rechazan

#### Scenario: Conversión exacta
- **WHEN** se convierten `"1.15"`, `"0.10"` y `"0.20"` a centavos
- **THEN** los resultados son exactamente 115, 10 y 20 (con floats, `1.15 * 100` da `114.99999999999999`)
- **AND** la suma de los centavos de `"0.10"` y `"0.20"` es exactamente 30

### Requirement: CTR-09 Validación de CLABE con dígito verificador
El paquete SHALL exportar un validador de CLABE que exija exactamente 18 dígitos como string y verifique el dígito de control: sobre los primeros 17 dígitos con pesos 3, 7, 1 repetidos, se suma cada producto módulo 10; con A igual a esa suma módulo 10, el dígito verificador MUST ser `(10 − A) mod 10`. El validador MUST conservar los ceros a la izquierda.

#### Scenario: CLABE válida
- **WHEN** se valida `"032180000118359719"`
- **THEN** la CLABE es válida

#### Scenario: Dígito verificador incorrecto
- **WHEN** se valida `"032180000118359718"`
- **THEN** la CLABE se rechaza por dígito verificador inválido

#### Scenario: Suma múltiplo de diez
- **WHEN** se valida una CLABE cuyos primeros 17 dígitos producen A = 0
- **THEN** el dígito verificador esperado es 0, no 10

#### Scenario: Formato incorrecto
- **WHEN** se validan una CLABE de 17 dígitos, una con letras y el número `32180000118359719`
- **THEN** las tres se rechazan

### Requirement: CTR-10 Validación de CURP con dígito verificador
El paquete SHALL exportar un validador de CURP que exija la estructura del contrato (18 caracteres en mayúsculas, fecha válida, sexo, entidad federativa, consonantes internas y diferenciador) y verifique el dígito final: con el diccionario `0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ`, la suma de cada uno de los primeros 17 caracteres por su peso (de 18 a 2) determina el dígito `(10 − suma mod 10) mod 10`. El validador MUST validar solo el formato, sin consultar fuentes externas de identidad.

#### Scenario: CURP válida
- **WHEN** se valida una CURP con estructura correcta y dígito verificador correcto
- **THEN** la CURP es válida

#### Scenario: Dígito verificador incorrecto
- **WHEN** se valida la misma CURP con el último dígito alterado
- **THEN** la CURP se rechaza por dígito verificador inválido

#### Scenario: Fecha imposible
- **WHEN** se valida una CURP con fecha `990231`
- **THEN** la CURP se rechaza por fecha inválida

### Requirement: CTR-11 Validación de RFC de persona física
El paquete SHALL exportar un validador de RFC de persona física (13 caracteres en mayúsculas) que verifique la estructura del contrato y que la fecha `AAMMDD` exista en el calendario. El validador del RFC por sí solo MUST NOT exigir que coincida con la CURP, porque no conoce otro campo. El esquema del formulario de registro (CTR-13) MUST rechazar un RFC cuyos primeros 10 caracteres no sean iguales a los primeros 10 de la CURP, con el error en `/rfc`, el código `INVALID_FORMAT` y el mensaje "El RFC no coincide con tu CURP"; si el RFC ya es inválido por sí solo, MUST NOT repetir el error de coincidencia.

#### Scenario: RFC válido
- **WHEN** se valida un RFC de 13 caracteres con fecha existente
- **THEN** el RFC es válido

#### Scenario: Fecha inexistente
- **WHEN** se valida un RFC con fecha `010229`
- **THEN** el RFC se rechaza por fecha inválida

#### Scenario: RFC de persona moral
- **WHEN** se valida un RFC de 12 caracteres
- **THEN** el RFC se rechaza

#### Scenario: RFC que no coincide con la CURP
- **WHEN** el formulario de registro trae una CURP y un RFC válidos cuyos primeros 10 caracteres difieren
- **THEN** el esquema lo rechaza en `/rfc` con `INVALID_FORMAT` y el mensaje "El RFC no coincide con tu CURP"

#### Scenario: RFC inválido por sí solo
- **WHEN** el formulario de registro trae un RFC con fecha inexistente
- **THEN** el esquema reporta solo el error de la fecha y no el de coincidencia con la CURP

### Requirement: CTR-12 Validación de teléfono, concepto, referencia y códigos
El paquete SHALL exportar validadores para el teléfono (exactamente 10 dígitos nacionales, el primero de 2 a 9), el concepto (1 a 40 caracteres, sin espacios al inicio ni al final), la referencia numérica opcional (string de 1 a 7 dígitos; ausente o vacía significa "sin referencia") y los códigos de un solo uso (exactamente 6 dígitos), con las mismas reglas que el contrato.

#### Scenario: Concepto con espacios en los extremos
- **WHEN** se valida el concepto `" Renta "`
- **THEN** el concepto se rechaza

#### Scenario: Referencia demasiado larga
- **WHEN** se valida la referencia `"12345678"`
- **THEN** la referencia se rechaza

#### Scenario: Referencia omitida
- **WHEN** se valida un formulario de transferencia sin referencia o con la referencia vacía
- **THEN** el esquema lo acepta y lo interpreta como "sin referencia"

#### Scenario: Código de un solo uso
- **WHEN** se validan `"123456"`, `"12345"` y `"1234567"`
- **THEN** el primero es válido y los otros dos se rechazan

#### Scenario: Teléfono que empieza con 0 o 1
- **WHEN** se validan `"5512345678"` y `"0512345678"`
- **THEN** el primero es válido y el segundo se rechaza

### Requirement: CTR-13 Esquemas de formularios alineados con el contrato
El paquete SHALL exportar esquemas de validación reutilizables en el cliente y en el servidor para los formularios de registro, verificación de correo, inicio de sesión, alta de beneficiario y transferencia, incluido el destino como unión discriminada (`OWN_ACCOUNT` o `BENEFICIARY`) y el instante programado opcional (`scheduledFor`). Para cada patrón del contrato, el validador del paquete MUST aceptar y rechazar exactamente los mismos vectores de prueba que el esquema correspondiente de `openapi.yaml`.

El esquema del formulario de registro SHALL aplicar además las reglas que JSON Schema no expresa, con un error por campo:
- el correo se recorta y se pasa a minúsculas antes de validarlo;
- `firstNames`, `paternalSurname` y `maternalSurname` (opcional; vacío equivale a omitido) son de 1 a 100 caracteres, sin espacios en los extremos ni repetidos, y solo con letras (con acentos y ñ), apóstrofo, guion y punto;
- el nombre completo que resulta de unir `firstNames`, `paternalSurname` y `maternalSurname` con un espacio no pasa de 100 caracteres (`TOO_LONG`, en `/firstNames`);
- la contraseña tiene de 12 a 128 caracteres, con al menos una letra y un dígito;
- `birthDate` tiene la forma `YYYY-MM-DD`, existe en el calendario y es igual a la fecha que codifica la CURP (`INVALID_FORMAT`, en `/birthDate`); una fecha futura se rechaza con `INVALID_DATE` y la de una persona menor de 18 años al día de hoy en `America/Mexico_City` con `DATE_OUT_OF_RANGE`, ambas en `/birthDate`;
- `birthState` es un código del catálogo de CTR-21 e igual a la entidad que codifica la CURP (`INVALID_FORMAT`, en `/birthState`);
- el RFC coincide con la CURP, como indica CTR-11.

Estas reglas entre campos solo aplican cuando cada campo, por separado, ya es válido.

El esquema del formulario de transferencia MUST tener una variante que, dado el instante actual, rechace un instante programado fuera de la ventana de CTR-18 con el código por campo `DATE_OUT_OF_RANGE`.

#### Scenario: Paridad con el contrato
- **WHEN** se evalúan los vectores de prueba de monto, CLABE, CURP, RFC, teléfono, concepto, referencia, nombre, contraseña y fecha programada contra el validador del paquete y contra el esquema del contrato
- **THEN** ambos aceptan y rechazan los mismos vectores

#### Scenario: Destino inválido
- **WHEN** el formulario de transferencia trae un destino con `type` `OWN_ACCOUNT` y un `beneficiaryId`
- **THEN** el esquema lo rechaza

#### Scenario: Errores por campo
- **WHEN** el formulario de transferencia tiene el monto `"100.005"` y el concepto vacío
- **THEN** el resultado identifica ambos campos con un código de error por campo

#### Scenario: Contraseña sin dígito
- **WHEN** el formulario de registro trae una contraseña de 12 letras sin ningún dígito
- **THEN** el esquema la rechaza en `/password`

#### Scenario: Instante programado imposible
- **WHEN** el formulario de transferencia trae `scheduledFor` `"2026-02-30T10:00:00-06:00"` o uno con segundos distintos de cero
- **THEN** el esquema lo rechaza en `/scheduledFor` con `INVALID_FORMAT`

#### Scenario: Instante programado fuera de la ventana
- **WHEN** el instante actual es 2026-10-14 12:00 en la Ciudad de México y el formulario trae `scheduledFor` `"2026-10-14T12:09:00-06:00"` o `"2027-01-12T12:01:00-06:00"`
- **THEN** la variante con ventana lo rechaza en `/scheduledFor` con `DATE_OUT_OF_RANGE`
- **AND** acepta `"2026-10-14T12:10:00-06:00"` y `"2027-01-12T12:00:00-06:00"`

#### Scenario: Nombre con dígitos
- **WHEN** el formulario de registro trae `firstNames` `"Ana2"`
- **THEN** el esquema lo rechaza en `/firstNames`

#### Scenario: Nombre completo demasiado largo
- **WHEN** el formulario de registro trae `firstNames` de 50 caracteres, `paternalSurname` de 40 y `maternalSurname` de 20
- **THEN** el esquema lo rechaza en `/firstNames` con `TOO_LONG`

#### Scenario: Nombres con acentos, ñ, apóstrofo, guion y punto
- **WHEN** el formulario de registro trae `firstNames` `"María-José"`, `paternalSurname` `"O'Brien"` y `maternalSurname` `"Ñ."`
- **THEN** el esquema lo acepta

#### Scenario: Apellido materno omitido
- **WHEN** el formulario de registro no trae `maternalSurname` o lo trae vacío
- **THEN** el esquema lo acepta

#### Scenario: Fecha o entidad distintas de la CURP
- **WHEN** el formulario de registro trae una CURP de quien nació el 1990-01-01 en `DF` con `birthDate` `"1990-01-02"` y `birthState` `"JC"`
- **THEN** el esquema lo rechaza en `/birthDate` y en `/birthState` con `INVALID_FORMAT`

#### Scenario: Mayoría de edad en la Ciudad de México
- **WHEN** el instante actual es 2026-10-14 a las 20:00 en la Ciudad de México (02:00 UTC del 15) y la `birthDate` es la de una persona que cumple 18 años el 15 de octubre, con la CURP correspondiente
- **THEN** el esquema la rechaza en `/birthDate` con `DATE_OUT_OF_RANGE`
- **AND** la acepta si la persona los cumple el 14 de octubre

#### Scenario: Fecha de nacimiento futura
- **WHEN** el formulario de registro trae una CURP y una `birthDate` iguales y posteriores a hoy
- **THEN** el esquema la rechaza en `/birthDate` con `INVALID_DATE`

### Requirement: CTR-14 Formato de montos en es-MX sin floats
El paquete SHALL exportar una función que formatee un monto recibido como string decimal en pesos mexicanos con la convención `es-MX` (símbolo `$`, separador de miles `,`, punto decimal y 2 decimales). El resultado MUST ser exacto para cualquier monto representable en el contrato y MUST NOT convertir el monto a número de punto flotante. El resultado MUST ser el mismo en entornos cuya implementación de `Intl.NumberFormat` no acepte strings.

#### Scenario: Monto común
- **WHEN** se formatea `"1250.50"`
- **THEN** el resultado es `$1,250.50`

#### Scenario: Monto negativo
- **WHEN** se formatea `"-150.00"`
- **THEN** el resultado es `-$150.00`

#### Scenario: Monto grande exacto
- **WHEN** se formatea `"9999999999999999.99"`
- **THEN** el resultado es `$9,999,999,999,999,999.99` sin pérdida de precisión

#### Scenario: Entorno sin soporte de strings en Intl
- **WHEN** se formatea `"1250.50"` con la alternativa para entornos sin soporte de strings
- **THEN** el resultado es idéntico al del entorno con soporte

### Requirement: CTR-15 Paquete agnóstico de entorno
El paquete SHALL funcionar sin cambios en Node.js 20 o superior y en el motor JavaScript de React Native. El paquete MUST NOT depender de APIs exclusivas de Node.js ni de React Native, y MUST publicarse con salida ESM, CommonJS y declaraciones de tipos, con los campos de entrada clásicos además del mapa de exports. Ambas salidas MUST funcionar, no solo resolver: el cliente creado con `require` MUST hacer peticiones igual que el creado con `import`.

#### Scenario: Uso desde Node
- **WHEN** un proyecto Node 20 importa el paquete con `import` y con `require`
- **THEN** ambas formas resuelven y exponen las mismas funciones

#### Scenario: Cliente creado con require
- **WHEN** un proyecto Node 20 carga el paquete con `require`, crea un cliente con `createApiClient` y hace una petición con un `fetch` propio
- **THEN** la petición llega a ese `fetch` con la URL de la ruta y el cliente devuelve la respuesta, igual que con `import`

#### Scenario: Sin APIs de Node
- **WHEN** se inspecciona el paquete construido
- **THEN** no contiene importaciones de módulos internos de Node.js

### Requirement: CTR-16 Distribución como artefacto, sin dependencias de código
Mientras todos los proyectos vivan en un solo repositorio, los consumidores SHALL instalar el paquete desde la carpeta `contract` como si fuera un paquete publicado (copiado, con sus dependencias instaladas, no como enlace simbólico), cada uno con su propio lockfile y sin necesidad de token ni de registro. La publicación en GitHub Packages bajo el scope del dueño del repositorio MUST ocurrir solo cuando los proyectos se separen en repositorios propios, y el procedimiento MUST estar documentado en el README del paquete.

#### Scenario: Instalación local sin token
- **WHEN** un evaluador clona el repositorio e instala las dependencias de `/web` sin credenciales de ningún registro
- **THEN** la instalación termina con éxito y el paquete queda disponible con sus dependencias

#### Scenario: No es un enlace simbólico
- **WHEN** se inspecciona el paquete instalado en un consumidor
- **THEN** es una copia del paquete y no un enlace simbólico a la carpeta `contract`

#### Scenario: Separación futura
- **WHEN** se lee el README del paquete
- **THEN** describe cómo publicarlo en GitHub Packages y qué línea cambia en cada consumidor

### Requirement: CTR-17 Verificación continua del paquete
El paquete SHALL tener su propio pipeline de CI que se ejecute ante cambios en la carpeta `contract`, y que falle si el lint del contrato, la vigencia de los tipos generados, el chequeo de tipos, las pruebas, el build o el empaquetado fallan.

#### Scenario: Cambio en el contrato
- **WHEN** se hace push de un cambio en `contract/`
- **THEN** el pipeline del paquete ejecuta lint, verificación de tipos generados, typecheck, pruebas, build y empaquetado

#### Scenario: Prueba fallida
- **WHEN** un vector de prueba de CLABE falla
- **THEN** el pipeline termina en rojo

### Requirement: CTR-18 Calendario de la Ciudad de México en el paquete
El paquete SHALL exportar una función que devuelve la fecha calendario (`YYYY-MM-DD`) y la hora (`HH:mm`) de un instante en `America/Mexico_City`, otra que combina una fecha y una hora de la Ciudad de México en el instante ISO que espera `scheduledFor`, y otra que devuelve la ventana programable: desde 10 minutos hasta 90 días después del instante dado, ambos inclusive. Todas MUST recibir el instante como parámetro, sin leer el reloj del sistema, y MUST funcionar en Node.js y en el motor JavaScript de React Native (CTR-15). El paquete SHALL exportar también los formatos de fecha y hora en palabras (`20 de octubre de 2026, 14:30`) de un instante en la Ciudad de México.

#### Scenario: Instante de noche
- **WHEN** se pide la fecha de 2026-10-01T05:30:00Z (23:30 del 30 de septiembre en la Ciudad de México)
- **THEN** la función devuelve la fecha `"2026-09-30"` y la hora `"23:30"`

#### Scenario: Ventana programable
- **WHEN** se pide la ventana para 2026-10-14T18:00:00Z
- **THEN** la ventana va de 2026-10-14T18:10:00Z a 2027-01-12T18:00:00Z

#### Scenario: Fecha y hora a instante
- **WHEN** se combinan la fecha `"2026-10-20"` y la hora `"14:30"` de la Ciudad de México
- **THEN** el instante es `2026-10-20T20:30:00.000Z`

#### Scenario: Fecha u hora inexistentes
- **WHEN** se combinan la fecha `"2026-02-30"` y la hora `"14:30"`
- **THEN** la función rechaza la combinación

### Requirement: CTR-19 Descarga de documentos binarios
El cliente tipado SHALL permitir obtener la respuesta `application/pdf` de `getAccountStatement` como bytes o como stream, sin intentar interpretarla como JSON. Una respuesta de error en esa misma ruta MUST llegar como el error tipado de CTR-07.

#### Scenario: PDF como bytes
- **WHEN** la API responde 200 con `Content-Type: application/pdf` y un cuerpo que empieza con `%PDF-`
- **THEN** el consumidor recibe los mismos bytes, que empiezan con `%PDF-`

#### Scenario: Error al pedir el PDF
- **WHEN** la API responde 404 `application/problem+json` con `code` `NOT_FOUND` en esa ruta
- **THEN** el consumidor recibe un error tipado con `code === "NOT_FOUND"`

### Requirement: CTR-20 Utilidades de captura y búsqueda de texto
El paquete SHALL exportar utilidades puras, usadas por la web y la app móvil, para que un campo no admita lo que el contrato rechazaría:
- una que deja solo dígitos (también al pegar) y recorta a una longitud máxima, para el teléfono, la referencia y los códigos de 6 dígitos;
- una que pasa a mayúsculas y deja solo letras, dígitos, `Ñ` y `&`, para la CURP y el RFC;
- una que sanea un monto mientras se escribe o se pega: solo dígitos y un punto, a lo más 2 decimales, a lo más 12 dígitos enteros y sin ceros a la izquierda; devuelve el texto con separadores de miles para mostrar y el monto sin separadores para enviar, y es idempotente sobre su propio resultado;
- una que decide si un beneficiario coincide con una búsqueda, sin distinguir mayúsculas ni acentos, por nombre y alias, y por CLABE cuando la consulta son solo dígitos.

El monto que devuelve la utilidad de montos MUST ser siempre uno que el contrato acepta (CTR-08), sin aritmética de punto flotante.

#### Scenario: Monto con letras y tres decimales
- **WHEN** se sanea `"12a,345.678"`
- **THEN** el texto para mostrar es `"12,345.67"` y el monto para enviar es `"12345.67"`

#### Scenario: Ceros a la izquierda
- **WHEN** se sanea `"007"` y `"0.5"`
- **THEN** los montos para enviar son `"7"` y `"0.5"`

#### Scenario: Idempotencia del saneamiento
- **WHEN** se vuelve a sanear el texto que ya se devolvió para mostrar
- **THEN** el resultado es el mismo

#### Scenario: Solo dígitos
- **WHEN** se pasa `"12-34 a5"` a la utilidad de dígitos con longitud máxima 7
- **THEN** el resultado es `"12345"`

#### Scenario: Mayúsculas de CURP y RFC
- **WHEN** se pasa `"ñu&a-12"` a la utilidad de mayúsculas alfanuméricas
- **THEN** el resultado es `"ÑU&A12"`

#### Scenario: Búsqueda sin acentos
- **WHEN** se busca `"jose"` entre los beneficiarios "José" y "Luis"
- **THEN** solo coincide "José"

#### Scenario: Búsqueda por CLABE
- **WHEN** la consulta son solo dígitos
- **THEN** coincide con los beneficiarios cuya CLABE los contiene y no con los que solo los tienen en el nombre

### Requirement: CTR-21 Catálogo de entidades de nacimiento
El paquete SHALL exportar el catálogo de entidades de nacimiento: los 33 códigos de dos letras que acepta el patrón de la CURP (las 32 entidades federativas y `NE`, nacido en el extranjero), cada uno con su nombre en español, ordenado por nombre y con `NE` al final, y una función que devuelve la entidad que codifica una CURP o `null` si la CURP no tiene la forma. El patrón de la CURP del contrato y el catálogo MUST aceptar exactamente los mismos códigos.

#### Scenario: Catálogo completo
- **WHEN** se lee el catálogo
- **THEN** tiene 33 entradas sin códigos repetidos, y `NE` es la última

#### Scenario: Paridad con el patrón de la CURP
- **WHEN** se evalúa cada código del catálogo y los códigos `XX` y `ZZ` dentro de una CURP de prueba
- **THEN** el validador acepta los 33 códigos del catálogo y rechaza `XX` y `ZZ`

#### Scenario: Entidad de una CURP
- **WHEN** se pide la entidad de una CURP válida con los caracteres 12 y 13 iguales a `DF`
- **THEN** la función devuelve `"DF"`

### Requirement: CTR-22 Respuesta 429 en el cierre de sesión
El contrato SHALL declarar la respuesta `429` con `code` `RATE_LIMITED` y el header `Retry-After` en `logout`, con la misma definición que usan las demás operaciones limitadas (PLT-09, IDN-17), y SHALL publicarse como versión menor `1.6.0`. El cliente tipado MUST entregar ese error como el error tipado de CTR-07.

#### Scenario: Logout limitado en el documento
- **WHEN** se lee `openapi.yaml`
- **THEN** la operación `logout` declara la respuesta `429` con `Retry-After`

#### Scenario: Error tipado
- **WHEN** la API responde `429 RATE_LIMITED` a `logout`
- **THEN** el consumidor recibe un error tipado con `code === "RATE_LIMITED"`

#### Scenario: Versión del paquete
- **WHEN** se publica este cambio del contrato
- **THEN** la versión del paquete es `1.6.0`

