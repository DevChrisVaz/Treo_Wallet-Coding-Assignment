## ADDED Requirements

### Requirement: BEN-12 Aviso del alta de un beneficiario
Después de un `POST /beneficiaries` que responde `201`, la API SHALL enviar al email del usuario el aviso "Agregaste a <alias> como beneficiario" con el nombre, el alias, los últimos 4 dígitos de la CLABE, la fecha y la hora en `America/Mexico_City`, e indicar qué hacer si no fue la persona. El aviso MUST NOT incluir la CLABE completa y MUST NOT enviarse con la repetición idéntica (`200`), con `409` ni con errores de validación. Una falla al enviarlo MUST NOT cambiar la respuesta (PLT-16).

#### Scenario: Alta de un beneficiario
- **WHEN** un usuario da de alta a un beneficiario nuevo
- **THEN** la respuesta es `201`
- **AND** a su email llega un solo correo "Agregaste a Luis como beneficiario" con el nombre, el alias y la terminación de la CLABE
- **AND** el correo no contiene la CLABE completa

#### Scenario: Repetición idéntica
- **WHEN** el usuario repite el alta con los mismos datos y la API responde `200`
- **THEN** no se envía ningún correo

#### Scenario: Alta rechazada
- **WHEN** el alta responde `409` o `422`
- **THEN** no se envía ningún correo

#### Scenario: Correo caído
- **WHEN** el servidor de correo no responde durante el alta
- **THEN** la respuesta es `201` con el mismo cuerpo
