## ADDED Requirements

### Requirement: MOB-24 Activación opcional del desbloqueo biométrico
Después de un inicio de sesión exitoso con contraseña, si el dispositivo tiene hardware biométrico con al menos una biometría registrada y el usuario no ha respondido antes en ese dispositivo, la app SHALL ofrecer activar el desbloqueo con el nombre del tipo disponible ("huella", "rostro" o "biometría").

- **"Activar"** MUST pedir la autenticación biométrica y activar el desbloqueo solo si tiene éxito.
- **"Ahora no"** MUST guardar esa respuesta y no volver a ofrecerlo hasta el siguiente inicio de sesión con contraseña después de cerrar sesión.
- **Interruptor:** la pantalla de inicio SHALL tener un interruptor "Desbloqueo con <tipo>". Activarlo exige la autenticación biométrica; desactivarlo no.
- **Sin biometría registrada:** la app MUST NOT ofrecer el desbloqueo y el interruptor MUST aparecer deshabilitado con una explicación.
- **Preferencia:** MUST guardarse en el almacenamiento seguro del sistema y MUST NOT contener tokens ni datos biométricos.

Amplía MOB-01 y MOB-02.

#### Scenario: Ofrecer el desbloqueo
- **WHEN** Ana inicia sesión con contraseña en un Android con una huella registrada
- **THEN** la app ofrece "Entrar con tu huella" con las opciones "Activar" y "Ahora no"

#### Scenario: Activación exitosa
- **WHEN** Ana pulsa "Activar" y la autenticación biométrica tiene éxito
- **THEN** el desbloqueo queda activo y el interruptor de la pantalla de inicio aparece encendido

#### Scenario: Activación cancelada
- **WHEN** Ana pulsa "Activar" y cancela el diálogo biométrico
- **THEN** el desbloqueo queda inactivo

#### Scenario: Ahora no
- **WHEN** Ana pulsa "Ahora no", cierra la app y la vuelve a abrir con la sesión guardada
- **THEN** la app no vuelve a ofrecer el desbloqueo

#### Scenario: Sin biometría registrada
- **WHEN** Ana inicia sesión en un dispositivo sin biometría registrada
- **THEN** la app no ofrece el desbloqueo y el interruptor aparece deshabilitado con una explicación

### Requirement: MOB-25 Bloqueo al abrir y al volver de segundo plano
Con el desbloqueo activo y un refresh token guardado, la app SHALL pedir la autenticación biométrica en dos momentos:
- al abrirse en frío, antes de restaurar la sesión con la API (MOB-02) y antes de mostrar cualquier saldo;
- al volver a estar activa después de 60 segundos o más en segundo plano.

Una ausencia menor a 60 segundos MUST NOT pedirla.

Mientras no se desbloquea, la app MUST mostrar una pantalla de bloqueo con dos botones: "Desbloquear con <tipo>" (por ejemplo, "Desbloquear con huella"), que vuelve a pedir la biometría, y "Usar mi contraseña". La pantalla MUST NOT mostrar saldos, movimientos ni datos personales. La pantalla de privacidad (MOB-16) MUST mantenerse hasta que la pantalla de bloqueo la sustituya. Si el usuario cancela el diálogo biométrico, la app MUST quedarse en la pantalla de bloqueo sin volver a abrir el diálogo por su cuenta.

#### Scenario: Apertura en frío con desbloqueo activo
- **WHEN** Ana abre la app con el desbloqueo activo y una sesión guardada
- **THEN** la app pide la huella antes de hacer cualquier petición de renovación a la API
- **AND** tras autenticarse, restaura la sesión y muestra sus saldos

#### Scenario: Regreso rápido
- **WHEN** Ana manda la app a segundo plano y vuelve a los 30 segundos
- **THEN** la app no pide la huella y muestra la pantalla en la que estaba

#### Scenario: Regreso después de un minuto
- **WHEN** Ana vuelve a la app después de 90 segundos en segundo plano
- **THEN** la app muestra la pantalla de bloqueo y pide la huella antes de mostrar saldos

#### Scenario: Diálogo cancelado
- **WHEN** Ana cancela el diálogo biométrico
- **THEN** la app sigue en la pantalla de bloqueo con "Desbloquear con huella" y "Usar mi contraseña", sin mostrar saldos

#### Scenario: Desbloqueo inactivo
- **WHEN** Ana abre la app con el desbloqueo inactivo y una sesión guardada
- **THEN** la app restaura la sesión sin pedir biometría, como en MOB-02

### Requirement: MOB-26 Alternativas al desbloqueo biométrico
El diálogo biométrico SHALL aceptar como alternativa la credencial del dispositivo (PIN, patrón o contraseña).

- **"Usar mi contraseña":** MUST cerrar la sesión como en MOB-04 (revocar el refresh token y borrar los tokens aunque la API no responda), desactivar el desbloqueo y mostrar el inicio de sesión.
- **Biometría retirada o sin credencial del dispositivo:** si al pedir el desbloqueo el dispositivo ya no tiene biometría registrada ni credencial, la app MUST desactivar el desbloqueo, cerrar la sesión y pedir la contraseña.
- **Bloqueo temporal del sistema:** si el sistema bloquea temporalmente la biometría por demasiados intentos, la app MUST mostrar un mensaje que lo explique y mantener ambas opciones.

Amplía MOB-04.

#### Scenario: Usar mi contraseña
- **WHEN** Ana pulsa "Usar mi contraseña" en la pantalla de bloqueo
- **THEN** la app pide a la API la revocación del refresh token, borra los tokens y muestra el inicio de sesión
- **AND** el desbloqueo queda inactivo

#### Scenario: Huellas retiradas del dispositivo
- **WHEN** Ana quitó todas sus huellas del dispositivo y abre la app con el desbloqueo activo
- **THEN** la app desactiva el desbloqueo, cierra la sesión y muestra el inicio de sesión

#### Scenario: Demasiados intentos
- **WHEN** el sistema responde que la biometría está bloqueada temporalmente
- **THEN** la pantalla de bloqueo muestra "Demasiados intentos. Intenta más tarde o usa tu contraseña." con ambas opciones

### Requirement: MOB-27 Desactivación del desbloqueo
Cerrar sesión (MOB-04) o una sesión revocada (MOB-03) SHALL desactivar el desbloqueo y borrar su preferencia, incluida la respuesta "Ahora no". Así, el siguiente inicio de sesión con contraseña vuelve a ofrecerlo. Desactivar el interruptor MUST borrar la preferencia sin cerrar la sesión y MUST NOT volver a mostrar la oferta de MOB-24, que solo aparece después de un inicio de sesión con contraseña.

#### Scenario: Cierre de sesión
- **WHEN** Ana, con el desbloqueo activo, cierra sesión y vuelve a iniciar sesión con contraseña
- **THEN** la preferencia se borró y la app vuelve a ofrecer el desbloqueo

#### Scenario: Sesión revocada
- **WHEN** la renovación responde `401 SESSION_REVOKED` con el desbloqueo activo
- **THEN** la app borra los tokens y la preferencia y muestra el inicio de sesión

#### Scenario: Apagar el interruptor
- **WHEN** Ana apaga el interruptor y luego cierra y abre la app
- **THEN** la app restaura la sesión sin pedir biometría
