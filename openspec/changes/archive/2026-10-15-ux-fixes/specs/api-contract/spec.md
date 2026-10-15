## MODIFIED Requirements

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
- el nombre es un `PersonName`: de 2 a 100 caracteres, al menos dos palabras separadas por un solo espacio, sin espacios en los extremos y solo con letras (con acentos y ñ), apóstrofo, guion y punto;
- la contraseña tiene de 12 a 128 caracteres, con al menos una letra y un dígito;
- la CURP corresponde a una persona de 18 años o más al día de hoy en `America/Mexico_City`: una fecha de nacimiento futura se rechaza con `INVALID_DATE` y la de una persona menor de 18 años con `DATE_OUT_OF_RANGE`, ambas en `/curp`;
- el RFC coincide con la CURP, como indica CTR-11.

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

#### Scenario: Nombre de una sola palabra o con dígitos
- **WHEN** el formulario de registro trae el nombre `"Ana"` o `"Ana 2 Pérez"`
- **THEN** el esquema lo rechaza en `/fullName`

#### Scenario: Nombre con acentos, ñ, apóstrofo y guion
- **WHEN** el formulario de registro trae el nombre `"María-José O'Brien Ñ."`
- **THEN** el esquema lo acepta

#### Scenario: Contraseña sin dígito
- **WHEN** el formulario de registro trae una contraseña de 12 letras sin ningún dígito
- **THEN** el esquema la rechaza en `/password`

#### Scenario: Mayoría de edad en la Ciudad de México
- **WHEN** el instante actual es 2026-10-14 a las 20:00 en la Ciudad de México (02:00 UTC del 15) y la CURP es de una persona que cumple 18 años el 15 de octubre
- **THEN** el esquema la rechaza en `/curp` con `DATE_OUT_OF_RANGE`
- **AND** la acepta si la persona los cumple el 14 de octubre

#### Scenario: Fecha de nacimiento futura
- **WHEN** el formulario de registro trae una CURP con fecha de nacimiento posterior a hoy
- **THEN** el esquema la rechaza en `/curp` con `INVALID_DATE`

#### Scenario: Instante programado imposible
- **WHEN** el formulario de transferencia trae `scheduledFor` `"2026-02-30T10:00:00-06:00"` o uno con segundos distintos de cero
- **THEN** el esquema lo rechaza en `/scheduledFor` con `INVALID_FORMAT`

#### Scenario: Instante programado fuera de la ventana
- **WHEN** el instante actual es 2026-10-14 12:00 en la Ciudad de México y el formulario trae `scheduledFor` `"2026-10-14T12:09:00-06:00"` o `"2027-01-12T12:01:00-06:00"`
- **THEN** la variante con ventana lo rechaza en `/scheduledFor` con `DATE_OUT_OF_RANGE`
- **AND** acepta `"2026-10-14T12:10:00-06:00"` y `"2027-01-12T12:00:00-06:00"`

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

## ADDED Requirements

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
