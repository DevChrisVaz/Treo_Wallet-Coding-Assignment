## MODIFIED Requirements

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


## ADDED Requirements

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
