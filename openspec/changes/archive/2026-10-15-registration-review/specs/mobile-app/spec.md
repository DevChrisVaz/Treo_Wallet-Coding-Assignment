## ADDED Requirements

### Requirement: MOB-30 Registro en revisión al iniciar sesión
Si el inicio de sesión responde `403 REGISTRATION_IN_REVIEW` (IDN-08), la app SHALL mostrar el mensaje de `REGISTRATION_IN_REVIEW` del paquete de diseño y MUST NOT guardar ninguna sesión ni llevar a otra pantalla.

#### Scenario: Usuario en revisión
- **WHEN** la API responde `403` con `code` `REGISTRATION_IN_REVIEW` al iniciar sesión
- **THEN** la app muestra "Tu registro está en revisión. Te escribiremos a tu correo cuando terminemos." en la pantalla de inicio de sesión
- **AND** no guarda ningún token
