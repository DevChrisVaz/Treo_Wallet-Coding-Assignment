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
Cuando la API responda con `application/problem+json`, el cliente SHALL entregar al consumidor un error tipado que exponga `status`, `code`, `title`, `detail`, `requestId` y las extensiones (`errors`, `transferId`, `transferStatus`, `remaining`, `attemptsRemaining`). El campo `code` MUST tiparse como la unión de los valores de `ProblemCode` del contrato. Los fallos sin respuesta HTTP (red caída, timeout) MUST distinguirse de los errores de la API, porque son los únicos que el consumidor puede reintentar con la misma llave.

#### Scenario: Saldo insuficiente
- **WHEN** la API responde 422 con `code` `INSUFFICIENT_FUNDS` y un `transferId`
- **THEN** el consumidor recibe un error tipado con `code === "INSUFFICIENT_FUNDS"` y el `transferId`

#### Scenario: Pérdida de red
- **WHEN** la petición falla sin recibir respuesta HTTP
- **THEN** el consumidor recibe un error de red distinguible de un error de la API

#### Scenario: Respuesta de error que no es problem+json
- **WHEN** la API o un intermediario responde 502 con un cuerpo HTML
- **THEN** el consumidor recibe un error tipado con `code` `INTERNAL_ERROR` y el `status` original, sin exponer el cuerpo recibido

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
El paquete SHALL exportar un validador de RFC de persona física (13 caracteres en mayúsculas) que verifique la estructura del contrato y que la fecha `AAMMDD` exista en el calendario. El validador MUST NOT exigir que el RFC coincida con la CURP.

#### Scenario: RFC válido
- **WHEN** se valida un RFC de 13 caracteres con fecha existente
- **THEN** el RFC es válido

#### Scenario: Fecha inexistente
- **WHEN** se valida un RFC con fecha `010229`
- **THEN** el RFC se rechaza por fecha inválida

#### Scenario: RFC de persona moral
- **WHEN** se valida un RFC de 12 caracteres
- **THEN** el RFC se rechaza

### Requirement: CTR-12 Validación de teléfono, concepto, referencia y códigos
El paquete SHALL exportar validadores para el teléfono (10 dígitos nacionales), el concepto (1 a 40 caracteres, sin espacios al inicio ni al final), la referencia numérica (string de 1 a 7 dígitos) y los códigos de un solo uso (6 dígitos), con las mismas reglas que el contrato.

#### Scenario: Concepto con espacios en los extremos
- **WHEN** se valida el concepto `" Renta "`
- **THEN** el concepto se rechaza

#### Scenario: Referencia demasiado larga
- **WHEN** se valida la referencia `"12345678"`
- **THEN** la referencia se rechaza

#### Scenario: Código de un solo uso
- **WHEN** se validan `"123456"` y `"12345"`
- **THEN** el primero es válido y el segundo se rechaza

### Requirement: CTR-13 Esquemas de formularios alineados con el contrato
El paquete SHALL exportar esquemas de validación reutilizables en el cliente y en el servidor para los formularios de registro, verificación de correo, inicio de sesión, alta de beneficiario y transferencia, incluido el destino como unión discriminada (`OWN_ACCOUNT` o `BENEFICIARY`). Para cada patrón del contrato, el validador del paquete MUST aceptar y rechazar exactamente los mismos vectores de prueba que el esquema correspondiente de `openapi.yaml`.

#### Scenario: Paridad con el contrato
- **WHEN** se evalúan los vectores de prueba de monto, CLABE, CURP, RFC, teléfono, concepto y referencia contra el validador del paquete y contra el esquema del contrato
- **THEN** ambos aceptan y rechazan los mismos vectores

#### Scenario: Destino inválido
- **WHEN** el formulario de transferencia trae un destino con `type` `OWN_ACCOUNT` y un `beneficiaryId`
- **THEN** el esquema lo rechaza

#### Scenario: Errores por campo
- **WHEN** el formulario de transferencia tiene el monto `"100.005"` y el concepto vacío
- **THEN** el resultado identifica ambos campos con un código de error por campo

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
El paquete SHALL funcionar sin cambios en Node.js 20 o superior y en el motor JavaScript de React Native. El paquete MUST NOT depender de APIs exclusivas de Node.js ni de React Native, y MUST publicarse con salida ESM, CommonJS y declaraciones de tipos, con los campos de entrada clásicos además del mapa de exports.

#### Scenario: Uso desde Node
- **WHEN** un proyecto Node 20 importa el paquete con `import` y con `require`
- **THEN** ambas formas resuelven y exponen las mismas funciones

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
