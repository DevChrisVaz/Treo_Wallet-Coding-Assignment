## MODIFIED Requirements

### Requirement: AUD-01 Catálogo de eventos auditados
La API SHALL registrar en la bitácora de auditoría los eventos de este catálogo, y solo estos:
- Identidad: `USER_REGISTERED`, `EMAIL_VERIFIED`, `EMAIL_VERIFICATION_RESENT`, `REGISTRATION_IN_REVIEW` (con qué datos de identidad chocaron, como `curpTaken`, `rfcTaken` y `phoneTaken`), `LOGIN_SUCCEEDED`, `LOGIN_FAILED` (con el motivo), `LOGOUT`.
- Seguridad: `REFRESH_TOKEN_REUSE_DETECTED`, `OTP_ATTEMPT_FAILED` y `OTP_ATTEMPTS_EXHAUSTED` (para ambos propósitos de código, indicado en los metadatos).
- Beneficiarios: `BENEFICIARY_CREATED`.
- Transferencias: `TRANSFER_CREATED` (con el estado inicial), `TRANSFER_OTP_SENT`, `TRANSFER_OTP_RESENT`, `TRANSFER_COMPLETED`, `TRANSFER_REJECTED` (con el motivo), `TRANSFER_FAILED` (con el motivo).
- Sistema: `FUNDING_POSTED`, con actor de tipo sistema.

Cada evento MUST incluir el momento en que ocurrió, el tipo de actor (`USER`, `SYSTEM` o `ANONYMOUS`), el id del actor cuando exista, la acción, el tipo y el id de la entidad afectada cuando exista, el `requestId`, la IP del cliente, el user agent y metadatos. Las lecturas MUST NOT auditarse.

#### Scenario: Login exitoso auditado
- **WHEN** un usuario inicia sesión correctamente
- **THEN** existe un evento `LOGIN_SUCCEEDED` con actor `USER`, su id, el `requestId`, la IP y el user agent de la petición

#### Scenario: Reuso de refresh token auditado
- **WHEN** se detecta el reuso de un refresh token
- **THEN** existe un evento `REFRESH_TOKEN_REUSE_DETECTED` con el id de la familia revocada en los metadatos

#### Scenario: Las lecturas no se auditan
- **WHEN** un usuario llama a `GET /me`
- **THEN** no se agrega ningún evento a la bitácora

#### Scenario: Registro en revisión auditado
- **WHEN** un usuario en revisión cuyo RFC era de otro usuario verifica su correo
- **THEN** existe un evento `REGISTRATION_IN_REVIEW` sobre ese usuario con `rfcTaken` verdadero y sin el RFC en los metadatos
