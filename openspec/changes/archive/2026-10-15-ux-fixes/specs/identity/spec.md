## MODIFIED Requirements

### Requirement: IDN-02 Datos obligatorios del registro
El registro SHALL exigir email, contraseña, nombre completo, CURP, RFC y teléfono. La API MUST normalizar el email (sin espacios al inicio o al final y en minúsculas, a lo más 254 caracteres). Con `422 VALIDATION_FAILED` y el `pointer` de cada campo, MUST rechazar:
- una contraseña de menos de 12 o más de 128 caracteres, o sin al menos una letra y un dígito;
- un nombre completo que no sea un `PersonName`: de 2 a 100 caracteres, al menos dos palabras separadas por un solo espacio, sin espacios al inicio ni al final y solo con letras (con acentos y ñ), apóstrofo, guion y punto;
- una CURP con estructura o dígito verificador inválidos, con fecha de nacimiento inexistente o futura (`INVALID_DATE`) o de una persona menor de 18 años al día de hoy en `America/Mexico_City` (`DATE_OUT_OF_RANGE`);
- un RFC de persona física con estructura inválida, con fecha inexistente o cuyos primeros 10 caracteres no sean los de la CURP (`INVALID_FORMAT`, "El RFC no coincide con tu CURP");
- un teléfono que no sea de exactamente 10 dígitos nacionales o cuyo primer dígito sea 0 o 1.

El teléfono válido MUST guardarse en formato E.164 (`+52` seguido de los 10 dígitos). La mayoría de edad se mide con el reloj de la API, no con el del cliente. La identidad no se verifica contra registros oficiales.

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

#### Scenario: Nombre inválido
- **WHEN** se registra el nombre `"Ana"`, `"Ana  Pérez"` o `"Ana Pérez 2"`
- **THEN** la API responde `422 VALIDATION_FAILED` con `pointer` igual a `/fullName`

#### Scenario: Nombre con acentos, ñ, apóstrofo y guion
- **WHEN** se registra el nombre `"María-José O'Brien Ñ."` con los demás datos válidos
- **THEN** la API acepta el registro

#### Scenario: Menor de edad por un día
- **WHEN** se registra una CURP de quien cumple 18 años mañana en la Ciudad de México
- **THEN** la API responde `422 VALIDATION_FAILED` con `pointer` igual a `/curp` y `code` `DATE_OUT_OF_RANGE`
- **AND** no se guarda ningún dato

#### Scenario: Cumple 18 años hoy
- **WHEN** se registra una CURP de quien cumple 18 años hoy en la Ciudad de México
- **THEN** la API acepta el registro

#### Scenario: Fecha de nacimiento futura
- **WHEN** se registra una CURP cuya fecha de nacimiento es posterior a hoy
- **THEN** la API responde `422 VALIDATION_FAILED` con `pointer` igual a `/curp` y `code` `INVALID_DATE`

#### Scenario: Teléfono que empieza con 0 o 1
- **WHEN** se registra el teléfono `"0512345678"` o `"1512345678"`
- **THEN** la API responde `422 VALIDATION_FAILED` con `pointer` igual a `/phone`

#### Scenario: Email con mayúsculas y espacios
- **WHEN** se registra `"  Ana@Example.COM "` y después se inicia sesión con `ana@example.com`
- **THEN** ambos se refieren al mismo usuario
