## MODIFIED Requirements

### Requirement: WEB-11 Registro y verificación de correo
La web SHALL ofrecer un registro con email, contraseña, confirmación de la contraseña, nombres, apellido paterno, apellido materno (opcional), fecha de nacimiento, entidad de nacimiento, CURP, RFC y teléfono, validados en el formulario con las reglas del contrato (CTR-13). Cada campo MUST validarse al salir de él, sin esperar al envío, y corregirse al teclear. La confirmación de la contraseña es un campo solo de la interfaz: MUST coincidir con la contraseña y MUST NOT enviarse a la API. Mientras se escribe, la CURP y el RFC MUST quedar en mayúsculas alfanuméricas con un máximo de 18 y 13 caracteres, y el teléfono en dígitos con un máximo de 10, también al pegar. El email MUST enviarse recortado y en minúsculas. La entidad de nacimiento MUST elegirse de una lista con los nombres del catálogo del contrato (CTR-21) y enviarse como código; la web MUST NOT rellenar la fecha ni la entidad a partir de la CURP, para que se contrasten como datos independientes (CTR-13). Si la API acepta el registro (`202`), la web MUST mostrar siempre el mismo mensaje genérico y llevar al usuario a la verificación, donde captura el código de 6 dígitos y puede pedir un reenvío. Si la API responde `422` con errores de campo, la web MUST mostrar cada mensaje bajo su campo y quedarse en el formulario. Al verificar, la web SHALL iniciar la sesión con los tokens recibidos y mostrar el resumen de cuentas. Si la verificación responde `403 REGISTRATION_IN_REVIEW` (IDN-06), la web MUST mostrar el mensaje de `REGISTRATION_IN_REVIEW` del paquete de diseño, MUST NOT iniciar sesión y MUST ofrecer volver al inicio de sesión.

#### Scenario: Registro enviado
- **WHEN** el usuario envía un registro válido
- **THEN** la web muestra "Si los datos son correctos, recibirás un correo con las instrucciones." y la pantalla de verificación

#### Scenario: CURP con dígito verificador inválido
- **WHEN** el usuario escribe una CURP cuyo último dígito no corresponde al cálculo del verificador
- **THEN** el formulario marca el campo CURP como inválido y no envía la petición

#### Scenario: Confirmación de contraseña distinta
- **WHEN** la confirmación de la contraseña no coincide con la contraseña y el usuario sale del campo
- **THEN** el formulario marca la confirmación como inválida
- **AND** la petición de registro nunca lleva ese campo

#### Scenario: RFC que no coincide con la CURP
- **WHEN** los primeros 10 caracteres del RFC difieren de los de la CURP
- **THEN** el formulario marca el RFC con "El RFC no coincide con tu CURP"

#### Scenario: Campos restringidos al escribir
- **WHEN** el usuario escribe o pega `"gomc-900101 hdf"` en la CURP y `"55 1234-5678 x"` en el teléfono
- **THEN** la CURP queda `"GOMC900101HDF"` y el teléfono `"5512345678"`

#### Scenario: Email con mayúsculas y espacios
- **WHEN** el usuario escribe `" Ana@Example.COM "`
- **THEN** la petición lleva `"ana@example.com"`

#### Scenario: Error del servidor en un campo
- **WHEN** la API responde 422 con un error en `/curp` o `/rfc`
- **THEN** la web lo muestra bajo ese campo

#### Scenario: Código incorrecto
- **WHEN** el usuario envía un código incorrecto y la API responde `VERIFICATION_CODE_INVALID` con `attemptsRemaining` 2
- **THEN** la web muestra "El código no es correcto o ya venció. Te quedan 2 intentos." (mensaje de `VERIFICATION_CODE_INVALID` del paquete de diseño más los intentos)

#### Scenario: Verificación exitosa
- **WHEN** el usuario envía el código correcto
- **THEN** la web crea la sesión y muestra el resumen con las cuentas "Principal" y "Ahorro" en $0.00

#### Scenario: Validación al salir del campo
- **WHEN** el usuario escribe unos nombres con un dígito y pasa al siguiente campo
- **THEN** el formulario marca los nombres como inválidos sin haber enviado el registro

#### Scenario: Fecha o entidad distintas de la CURP
- **WHEN** la fecha de nacimiento o la entidad elegidas no son las que codifica la CURP y el usuario sale del campo
- **THEN** el formulario marca la fecha con "La fecha no coincide con tu CURP" o la entidad con "La entidad no coincide con tu CURP"
- **AND** no envía la petición

#### Scenario: Apellido materno opcional
- **WHEN** el usuario deja vacío el apellido materno
- **THEN** el formulario no lo marca como inválido
- **AND** la petición no lleva `maternalSurname`

#### Scenario: Entidad por nombre
- **WHEN** el usuario elige "Ciudad de México" en la entidad de nacimiento
- **THEN** la petición lleva `birthState` igual a `"DF"`

#### Scenario: Registro en revisión al verificar
- **WHEN** el usuario envía el código correcto y la API responde `403` con `code` `REGISTRATION_IN_REVIEW`
- **THEN** la web muestra "Tu registro está en revisión. Te escribiremos a tu correo cuando terminemos." y un enlace para volver a iniciar sesión
- **AND** no crea ninguna sesión

### Requirement: WEB-12 Inicio de sesión
La web SHALL ofrecer un inicio de sesión con email y contraseña. Ante credenciales inválidas MUST mostrar un único mensaje genérico. Si la API responde `EMAIL_NOT_VERIFIED`, la web SHALL llevar al usuario a la verificación de ese correo. Si responde `REGISTRATION_IN_REVIEW`, la web MUST mostrar su mensaje y quedarse en el inicio de sesión. Si responde `RATE_LIMITED`, MUST indicar cuánto esperar según `Retry-After`.

#### Scenario: Credenciales inválidas
- **WHEN** la API responde `INVALID_CREDENTIALS`
- **THEN** la web muestra "El correo o la contraseña no coinciden." (mensaje de `INVALID_CREDENTIALS` del paquete de diseño) sin indicar cuál de los dos falló

#### Scenario: Correo sin verificar
- **WHEN** la API responde `403` con `code` `EMAIL_NOT_VERIFIED`
- **THEN** la web muestra la pantalla de verificación con el email precargado

#### Scenario: Demasiados intentos
- **WHEN** la API responde `429` con `Retry-After: 300`
- **THEN** la web muestra "Hiciste demasiados intentos. Espera un momento y vuelve a intentar. Intenta de nuevo en 5 minutos." (mensaje de `RATE_LIMITED` del paquete de diseño más la espera de `Retry-After`)

#### Scenario: Registro en revisión
- **WHEN** la API responde `403` con `code` `REGISTRATION_IN_REVIEW`
- **THEN** la web muestra "Tu registro está en revisión. Te escribiremos a tu correo cuando terminemos." (mensaje de `REGISTRATION_IN_REVIEW` del paquete de diseño) y no lleva a la verificación
