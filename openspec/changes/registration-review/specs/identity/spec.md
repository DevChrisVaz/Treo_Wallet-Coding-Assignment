## MODIFIED Requirements

### Requirement: IDN-03 Unicidad de los datos de identidad
El email SHALL ser único entre todos los usuarios, sin distinguir mayúsculas. La CURP, el RFC y el teléfono SHALL ser únicos entre los usuarios que no están en revisión. La base de datos MUST garantizar ambas reglas con índices únicos. Un registro con email nuevo cuya CURP, RFC o teléfono ya pertenecen a un usuario que no está en revisión MUST responder `202` con el mismo cuerpo que cualquier registro, MUST crear al usuario sin verificar y marcado en revisión, sin cuentas, y MUST enviar al email indicado el mismo correo con código de verificación que un registro nuevo. Nada en la respuesta ni en el correo MUST distinguir ese registro de uno con datos nuevos. Si el choque lo detecta el índice único (dos registros simultáneos), el resultado MUST ser el mismo.

#### Scenario: CURP de otro usuario con email nuevo
- **WHEN** se registra un email nuevo con la CURP de un usuario existente
- **THEN** la respuesta es `202` con el mismo cuerpo que un registro nuevo
- **AND** existe un usuario sin verificar con ese email, marcado en revisión y sin cuentas
- **AND** a ese email llega el mismo correo con un código de 6 dígitos que en un registro nuevo

#### Scenario: Unicidad garantizada en la base
- **WHEN** dos registros simultáneos usan el mismo RFC con emails distintos
- **THEN** a lo sumo uno de ellos crea un usuario que no está en revisión
- **AND** el otro queda en revisión

#### Scenario: Choque con un registro en revisión
- **WHEN** se registra un email nuevo con la CURP de un usuario que está en revisión y con datos que no tiene ningún otro usuario
- **THEN** el nuevo usuario no queda en revisión

### Requirement: IDN-06 Verificación de correo
`POST /auth/verify-email` SHALL, con un email y un código válidos, marcar el correo como verificado, abrir las cuentas del usuario (ACC-04), registrar el evento de auditoría y devolver `200` con el usuario y un par de tokens, todo en una sola transacción. Si el usuario está en revisión (IDN-03), la API MUST marcar el correo como verificado y consumir el código, MUST NOT abrir cuentas ni emitir tokens, MUST registrar `REGISTRATION_IN_REVIEW` y MUST responder `403 REGISTRATION_IN_REVIEW`. Un código incorrecto MUST responder `422 VERIFICATION_CODE_INVALID` con `attemptsRemaining`; al tercer fallo el código MUST quedar inutilizable. Un email inexistente o ya verificado MUST responder igual que un código incorrecto, sin revelar el motivo.

#### Scenario: Verificación exitosa
- **WHEN** un usuario sin verificar envía su email y el código vigente
- **THEN** la respuesta es `200` con `user` y `tokens`
- **AND** el usuario queda verificado y tiene sus dos cuentas

#### Scenario: Verificación de un registro en revisión
- **WHEN** un usuario en revisión envía su email y el código vigente
- **THEN** la API responde `403 REGISTRATION_IN_REVIEW` sin tokens
- **AND** el correo queda verificado y el usuario no tiene cuentas
- **AND** existe un evento `REGISTRATION_IN_REVIEW` que indica qué datos chocaron

#### Scenario: Tercer intento fallido
- **WHEN** se envía un código incorrecto por tercera vez
- **THEN** la API responde `422 VERIFICATION_CODE_INVALID` con `attemptsRemaining` igual a 0
- **AND** el código correcto ya no funciona

#### Scenario: Email desconocido
- **WHEN** se intenta verificar un email que no existe
- **THEN** la respuesta es la misma que con un código incorrecto

### Requirement: IDN-08 Inicio de sesión sin enumeración
`POST /auth/login` SHALL devolver `200` con el usuario y un par de tokens cuando el email y la contraseña son correctos, el correo está verificado y el usuario no está en revisión. Si el email no existe o la contraseña es incorrecta, MUST responder `401 INVALID_CREDENTIALS` con el mismo cuerpo, y MUST ejecutar la verificación de contraseña también cuando el email no existe, para que ambos casos tarden lo mismo. Con contraseña correcta y correo sin verificar MUST responder `403 EMAIL_NOT_VERIFIED`. Con contraseña correcta, correo verificado y usuario en revisión MUST responder `403 REGISTRATION_IN_REVIEW`.

#### Scenario: Email inexistente y contraseña incorrecta responden igual
- **WHEN** se intenta iniciar sesión con un email inexistente y, por separado, con un email existente y contraseña incorrecta
- **THEN** ambas respuestas son `401 INVALID_CREDENTIALS` con el mismo cuerpo salvo el `requestId`
- **AND** en ambos casos se ejecuta la verificación de un hash de contraseña

#### Scenario: Correo sin verificar
- **WHEN** un usuario sin verificar inicia sesión con su contraseña correcta
- **THEN** la API responde `403 EMAIL_NOT_VERIFIED`

#### Scenario: Usuario en revisión
- **WHEN** un usuario en revisión con el correo verificado inicia sesión con su contraseña correcta
- **THEN** la API responde `403 REGISTRATION_IN_REVIEW` sin tokens

#### Scenario: Usuario en revisión con contraseña incorrecta
- **WHEN** un usuario en revisión inicia sesión con una contraseña incorrecta
- **THEN** la API responde `401 INVALID_CREDENTIALS`

## ADDED Requirements

### Requirement: IDN-16 Aviso al dueño de los datos de identidad
Cuando un usuario en revisión verifica su correo, la API SHALL avisar a cada usuario que no está en revisión y cuya CURP, RFC o teléfono chocó con ese registro, una sola vez por usuario. El aviso MUST NOT incluir el correo de quien lo intentó ni cuál dato se usó, y MUST NOT enviarse al registrar ni en un reenvío.

#### Scenario: Aviso tras la verificación
- **WHEN** un usuario en revisión verifica su correo y su teléfono es el de un usuario existente
- **THEN** al correo de ese usuario existente llega "Alguien intentó registrarse con tus datos"
- **AND** el aviso no contiene el correo de quien se registró ni el teléfono

#### Scenario: Sin aviso al registrar
- **WHEN** se registra un email nuevo con la CURP de un usuario existente y nadie verifica el correo
- **THEN** el usuario existente no recibe ningún correo

#### Scenario: Un solo aviso por dueño
- **WHEN** un usuario en revisión verifica su correo y su CURP y su RFC son los de un mismo usuario existente
- **THEN** ese usuario recibe un solo aviso
