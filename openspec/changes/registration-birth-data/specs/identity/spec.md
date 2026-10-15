## MODIFIED Requirements

### Requirement: IDN-02 Datos obligatorios del registro
El registro SHALL exigir email, contraseña, nombres, apellido paterno, fecha de nacimiento, entidad de nacimiento, CURP, RFC y teléfono; el apellido materno es opcional. La API MUST normalizar el email (sin espacios al inicio o al final y en minúsculas, a lo más 254 caracteres). Con `422 VALIDATION_FAILED` y el `pointer` de cada campo, MUST rechazar:
- una contraseña de menos de 12 o más de 128 caracteres, o sin al menos una letra y un dígito;
- nombres, apellido paterno o apellido materno (si se envía) que no sean de 1 a 100 caracteres, sin espacios al inicio, al final ni repetidos, y solo con letras (con acentos y ñ), apóstrofo, guion y punto; los nombres y el apellido paterno MUST NOT estar vacíos y el apellido materno vacío se trata como omitido;
- una CURP con estructura o dígito verificador inválidos, o con fecha de nacimiento inexistente (`INVALID_DATE`);
- una fecha de nacimiento (`birthDate`, `YYYY-MM-DD`) con formato inválido, distinta de la que codifica la CURP (`INVALID_FORMAT`, "La fecha no coincide con tu CURP"), futura (`INVALID_DATE`) o de una persona menor de 18 años al día de hoy en `America/Mexico_City` (`DATE_OUT_OF_RANGE`);
- una entidad de nacimiento (`birthState`) que no sea uno de los 33 códigos de la CURP, incluido `NE` para nacido en el extranjero, o que sea distinta de la que codifica la CURP (`INVALID_FORMAT`, "La entidad no coincide con tu CURP");
- un RFC de persona física con estructura inválida, con fecha inexistente o cuyos primeros 10 caracteres no sean los de la CURP (`INVALID_FORMAT`, "El RFC no coincide con tu CURP");
- un teléfono que no sea de exactamente 10 dígitos nacionales o cuyo primer dígito sea 0 o 1.

El teléfono válido MUST guardarse en formato E.164 (`+52` seguido de los 10 dígitos). La mayoría de edad se mide con el reloj de la API, no con el del cliente. La API MUST guardar los nombres, los apellidos, la fecha y la entidad de nacimiento, y componer el nombre completo uniendo nombres, apellido paterno y apellido materno (si existe) con un espacio, para guardarlo y devolverlo como `fullName`. La identidad no se verifica contra registros oficiales.

#### Scenario: CURP con dígito verificador incorrecto
- **WHEN** se registra una CURP con estructura válida pero cuyo último dígito no corresponde a los 17 caracteres anteriores
- **THEN** la API responde `422 VALIDATION_FAILED` con `pointer` igual a `/curp`


#### Scenario: RFC con fecha imposible
- **WHEN** se registra un RFC cuya fecha es `990231` (31 de febrero)
- **THEN** la API responde `422 VALIDATION_FAILED` con `pointer` igual a `/rfc`


#### Scenario: RFC que no coincide con la CURP
- **WHEN** se registra una CURP válida y un RFC válido cuyos primeros 10 caracteres son distintos a los de la CURP
- **THEN** la API responde `422 VALIDATION_FAILED` con `pointer` igual a `/rfc`, `code` `INVALID_FORMAT` y el mensaje "El RFC no coincide con tu CURP"
- **AND** no se crea ningún usuario


#### Scenario: Contraseña fuera de rango o sin dígito
- **WHEN** se registra una contraseña de 11 caracteres, de 129 caracteres o de 12 letras sin dígito
- **THEN** la API responde `422 VALIDATION_FAILED` con `pointer` igual a `/password`


#### Scenario: Teléfono que empieza con 0 o 1
- **WHEN** se registra el teléfono `"0512345678"` o `"1512345678"`
- **THEN** la API responde `422 VALIDATION_FAILED` con `pointer` igual a `/phone`


#### Scenario: Email con mayúsculas y espacios
- **WHEN** se registra `"  Ana@Example.COM "` y después se inicia sesión con `ana@example.com`
- **THEN** ambos se refieren al mismo usuario

#### Scenario: Nombre inválido
- **WHEN** se registra `firstNames` `"Ana2"`, `paternalSurname` `"Pérez  López"` o `firstNames` vacío
- **THEN** la API responde `422 VALIDATION_FAILED` con `pointer` igual a `/firstNames` o `/paternalSurname` según el campo

#### Scenario: Nombre con acentos, ñ, apóstrofo y guion
- **WHEN** se registra `firstNames` `"María-José"`, `paternalSurname` `"O'Brien"` y `maternalSurname` `"Ñ."` con los demás datos válidos
- **THEN** la API acepta el registro

#### Scenario: Apellido materno ausente
- **WHEN** se registra `firstNames` `"Ana"`, `paternalSurname` `"Pérez"` sin `maternalSurname` y con una CURP cuya posición 3 es `X`
- **THEN** la API acepta el registro
- **AND** el usuario queda con `fullName` igual a `"Ana Pérez"`

#### Scenario: Nombre completo compuesto
- **WHEN** se registra `firstNames` `"José Luis"`, `paternalSurname` `"Gómez"` y `maternalSurname` `"Cruz"`
- **THEN** el usuario queda con `fullName` igual a `"José Luis Gómez Cruz"`

#### Scenario: Fecha de nacimiento distinta de la CURP
- **WHEN** se registra una CURP de quien nació el 1990-01-01 con `birthDate` `"1990-01-02"`
- **THEN** la API responde `422 VALIDATION_FAILED` con `pointer` igual a `/birthDate`, `code` `INVALID_FORMAT` y el mensaje "La fecha no coincide con tu CURP"
- **AND** no se crea ningún usuario

#### Scenario: Entidad de nacimiento distinta de la CURP
- **WHEN** se registra una CURP con entidad `DF` y `birthState` `"JC"`
- **THEN** la API responde `422 VALIDATION_FAILED` con `pointer` igual a `/birthState`, `code` `INVALID_FORMAT` y el mensaje "La entidad no coincide con tu CURP"
- **AND** no se crea ningún usuario

#### Scenario: Nacido en el extranjero
- **WHEN** se registra una CURP con entidad `NE` y `birthState` `"NE"`
- **THEN** la API acepta el registro

#### Scenario: Entidad fuera del catálogo
- **WHEN** se registra `birthState` `"XX"`
- **THEN** la API responde `422 VALIDATION_FAILED` con `pointer` igual a `/birthState`

#### Scenario: Menor de edad por un día
- **WHEN** se registra una CURP y una `birthDate` de quien cumple 18 años mañana en la Ciudad de México
- **THEN** la API responde `422 VALIDATION_FAILED` con `pointer` igual a `/birthDate` y `code` `DATE_OUT_OF_RANGE`
- **AND** no se guarda ningún dato

#### Scenario: Cumple 18 años hoy
- **WHEN** se registra una CURP y una `birthDate` de quien cumple 18 años hoy en la Ciudad de México
- **THEN** la API acepta el registro

#### Scenario: Fecha de nacimiento futura
- **WHEN** se registra una CURP y una `birthDate` iguales y posteriores a hoy
- **THEN** la API responde `422 VALIDATION_FAILED` con `pointer` igual a `/birthDate` y `code` `INVALID_DATE`
