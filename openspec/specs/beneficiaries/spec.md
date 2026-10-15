# beneficiaries Specification

## Purpose

Permitir que el usuario registre y consulte beneficiarios identificados por una CLABE de 18 dígitos que corresponda a una cuenta de otro usuario de la plataforma, validando el dígito verificador y evitando duplicados, para usarlos como destino de transferencias.
## Requirements
### Requirement: BEN-01 Registro de un beneficiario
La API SHALL registrar un beneficiario con `name`, `alias` y `clabe` mediante `POST /beneficiaries` (`createBeneficiary`) y responder 201 con el beneficiario creado, asociado al usuario autenticado y a la cuenta de la plataforma que corresponde a esa CLABE.

#### Scenario: Alta exitosa
- **WHEN** Ana registra a Luis con nombre "Luis Pérez", alias "Luis" y la CLABE válida de la cuenta "Principal" de Luis
- **THEN** la API responde 201 con `id`, `name`, `alias`, `clabe` y `createdAt`
- **AND** el beneficiario aparece en `GET /beneficiaries` de Ana

### Requirement: BEN-02 Formato de los datos del beneficiario
La API SHALL rechazar con 422 y `code` `VALIDATION_FAILED` una CLABE que no sea un string de exactamente 18 dígitos, un `name` fuera de 1 a 100 caracteres o un `alias` fuera de 1 a 30 caracteres o con espacios al inicio o al final, indicando cada campo inválido en `errors[]` con su JSON Pointer.

#### Scenario: CLABE con 17 dígitos
- **WHEN** se envía una CLABE de 17 dígitos
- **THEN** la API responde 422 con `code` `VALIDATION_FAILED` y un error con `pointer` `/clabe`

#### Scenario: CLABE como número JSON
- **WHEN** se envía `clabe` como número en lugar de string
- **THEN** la API responde 422 con `code` `VALIDATION_FAILED`

### Requirement: BEN-03 Dígito verificador de la CLABE
La API SHALL validar el dígito verificador de la CLABE con el algoritmo de Banxico (pesos 3, 7 y 1 sobre los primeros 17 dígitos, `DV = (10 − (Σ (dígito × peso) mod 10) mod 10) mod 10`) y responder 422 con `code` `CLABE_INVALID` si no coincide.

#### Scenario: Dígito verificador incorrecto
- **WHEN** se envía `032180000118359718` (el dígito correcto es 9)
- **THEN** la API responde 422 con `code` `CLABE_INVALID`

#### Scenario: Suma múltiplo de diez
- **WHEN** se envía una CLABE cuya suma ponderada es múltiplo de 10 y su dígito verificador es 0
- **THEN** la API la acepta como válida

### Requirement: BEN-04 La CLABE debe pertenecer a la plataforma
La API SHALL responder 422 con `code` `CLABE_NOT_IN_PLATFORM` cuando la CLABE es válida pero su código de banco no es el de la plataforma o no corresponde a ninguna cuenta USER existente.

#### Scenario: CLABE de otro banco
- **WHEN** se envía una CLABE válida con un código de banco distinto al de la plataforma
- **THEN** la API responde 422 con `code` `CLABE_NOT_IN_PLATFORM`

#### Scenario: CLABE de la plataforma sin cuenta
- **WHEN** se envía una CLABE válida con el código de banco de la plataforma que no corresponde a ninguna cuenta USER
- **THEN** la API responde 422 con `code` `CLABE_NOT_IN_PLATFORM`

### Requirement: BEN-05 Una cuenta propia no puede ser beneficiario
La API SHALL responder 422 con `code` `BENEFICIARY_IS_OWN_ACCOUNT` cuando la CLABE corresponde a una cuenta del propio usuario autenticado. Las transferencias entre cuentas propias se hacen con el destino `OWN_ACCOUNT`.

#### Scenario: Registrar la propia cuenta de Ahorro
- **WHEN** Ana intenta registrar como beneficiario la CLABE de su cuenta "Ahorro"
- **THEN** la API responde 422 con `code` `BENEFICIARY_IS_OWN_ACCOUNT`

### Requirement: BEN-06 Orden de las validaciones
La API SHALL evaluar las validaciones del beneficiario en este orden y responder con el primer error encontrado: formato, dígito verificador, código de banco y existencia de la cuenta, cuenta propia, y finalmente duplicados.

#### Scenario: CLABE de otro banco con dígito incorrecto
- **WHEN** se envía una CLABE con código de banco ajeno y dígito verificador incorrecto
- **THEN** la API responde `CLABE_INVALID` y no `CLABE_NOT_IN_PLATFORM`

### Requirement: BEN-07 Idempotencia por contenido y conflictos
La API SHALL responder 200 con el beneficiario existente cuando el usuario registra otra vez la misma CLABE con el mismo `name` y `alias`, sin crear un duplicado. MUST responder 409 con `code` `BENEFICIARY_CONFLICT` cuando la CLABE ya está registrada con otro `name` o `alias`, o cuando el `alias` ya lo usa otro beneficiario del mismo usuario.

#### Scenario: Reintento tras pérdida de red
- **WHEN** la respuesta 201 de un alta se pierde y el cliente reenvía exactamente los mismos datos
- **THEN** la API responde 200 con el mismo `id`
- **AND** el usuario sigue teniendo un solo beneficiario con esa CLABE

#### Scenario: Misma CLABE con otro alias
- **WHEN** el usuario registra una CLABE que ya tiene con un alias distinto
- **THEN** la API responde 409 con `code` `BENEFICIARY_CONFLICT`

#### Scenario: Alias repetido
- **WHEN** el usuario registra otra CLABE con un alias que ya usa
- **THEN** la API responde 409 con `code` `BENEFICIARY_CONFLICT`

### Requirement: BEN-08 Integridad de beneficiarios en la base de datos
La base de datos SHALL impedir beneficiarios duplicados por usuario y CLABE, alias duplicados por usuario y CLABEs con dígito verificador inválido, mediante constraints con nombre explícito, aunque la aplicación no lo valide.

#### Scenario: Inserción directa con CLABE inválida
- **WHEN** se inserta directamente en la base un beneficiario con una CLABE de dígito verificador incorrecto
- **THEN** PostgreSQL rechaza la inserción por una constraint `CHECK`

#### Scenario: Inserción concurrente duplicada
- **WHEN** dos peticiones simultáneas registran la misma CLABE con datos distintos para el mismo usuario
- **THEN** solo una crea el beneficiario y la otra recibe 409 `BENEFICIARY_CONFLICT`

### Requirement: BEN-09 Listado de beneficiarios
La API SHALL responder `GET /beneficiaries` (`listBeneficiaries`) solo con los beneficiarios del usuario autenticado, ordenados por alias.

#### Scenario: Beneficiarios de otro usuario
- **WHEN** Ana y Luis tienen beneficiarios registrados y Ana consulta el listado
- **THEN** la respuesta contiene solo los beneficiarios de Ana, ordenados por alias

### Requirement: BEN-10 Límite de altas de beneficiarios
La API SHALL limitar el registro de beneficiarios a 10 intentos por hora por usuario y responder 429 con `code` `RATE_LIMITED` y el header `Retry-After` al excederlo, para mitigar la enumeración de CLABEs de la plataforma.

#### Scenario: Undécimo intento en una hora
- **WHEN** un usuario hace su undécimo intento de alta en la misma hora
- **THEN** la API responde 429 con `code` `RATE_LIMITED` y header `Retry-After`

### Requirement: BEN-11 Auditoría del alta de beneficiarios
El sistema SHALL registrar el evento de auditoría `BENEFICIARY_CREATED` en la misma transacción en la que se crea el beneficiario, sin datos personales en el evento. Una respuesta 200 por reintento idéntico MUST NOT generar un evento nuevo.

#### Scenario: Alta auditada
- **WHEN** se crea un beneficiario
- **THEN** existe un evento `BENEFICIARY_CREATED` con el `id` del beneficiario y del usuario, sin CLABE completa ni nombre

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

