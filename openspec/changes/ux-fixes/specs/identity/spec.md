## MODIFIED Requirements

### Requirement: IDN-01 Registro con respuesta uniforme
`POST /auth/register` SHALL responder `202` con el mismo cuerpo sin importar si el email ya existe, para no permitir la enumeración de cuentas por correo. Según el estado del email, la API MUST hacer exactamente una de estas acciones: si el email es nuevo y los datos son válidos y únicos, crear el usuario sin verificar y enviarle un código de verificación; si el email pertenece a un usuario verificado, enviar a ese email un aviso de intento de registro sin crear nada; si el email pertenece a un usuario sin verificar, reenviar el código de verificación conservando los datos originales del registro. Un email nuevo con la CURP, el RFC o el teléfono de otro usuario se rechaza como indica IDN-03.

#### Scenario: Email nuevo
- **WHEN** se registra un email que no existe con datos válidos y únicos
- **THEN** la respuesta es `202`
- **AND** existe un usuario sin verificar con ese email
- **AND** a ese email llega un correo con un código de 6 dígitos

#### Scenario: Email ya verificado
- **WHEN** se registra un email que pertenece a un usuario verificado
- **THEN** la respuesta es `202` con el mismo cuerpo que en un registro nuevo
- **AND** no se crea ni modifica ningún usuario
- **AND** al email llega un aviso de que alguien intentó registrarse con él

#### Scenario: Email registrado sin verificar
- **WHEN** se registra de nuevo un email cuyo usuario aún no verifica, con datos distintos
- **THEN** la respuesta es `202`
- **AND** los datos guardados del usuario no cambian
- **AND** se envía un código nuevo que invalida el anterior

### Requirement: IDN-03 Unicidad de los datos de identidad
Email, CURP, RFC y teléfono SHALL ser únicos entre todos los usuarios, y la base de datos MUST garantizarlo con constraints únicas (el email sin distinguir mayúsculas). Un registro con email nuevo que choca con la CURP, el RFC o el teléfono de otro usuario MUST responder `422 VALIDATION_FAILED` con un error `ALREADY_REGISTERED` en el `pointer` de cada dato que choca, en el orden `/curp`, `/rfc`, `/phone`, con los mensajes "Esta CURP ya está registrada en otra cuenta.", "Este RFC ya está registrado en otra cuenta." y "Este teléfono ya está registrado en otra cuenta.". En ese caso la API MUST NOT crear al usuario ni enviar ningún correo. Si el choque lo detecta la constraint única (dos registros simultáneos), la respuesta MUST ser la misma, con el campo de esa constraint.

#### Scenario: CURP de otro usuario con email nuevo
- **WHEN** se registra un email nuevo con la CURP de un usuario existente
- **THEN** la API responde `422 VALIDATION_FAILED` con `pointer` igual a `/curp`, `code` `ALREADY_REGISTERED` y el mensaje "Esta CURP ya está registrada en otra cuenta."
- **AND** no se crea el usuario
- **AND** no se envía ningún correo

#### Scenario: Varios datos de otro usuario
- **WHEN** se registra un email nuevo con la CURP y el teléfono de un usuario existente
- **THEN** la API responde `422 VALIDATION_FAILED` con dos errores `ALREADY_REGISTERED`, primero en `/curp` y después en `/phone`

#### Scenario: Unicidad garantizada en la base
- **WHEN** dos registros simultáneos usan el mismo RFC con emails distintos
- **THEN** a lo sumo uno de ellos crea un usuario
- **AND** el otro recibe `422 VALIDATION_FAILED` con `pointer` igual a `/rfc` y `code` `ALREADY_REGISTERED`

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
