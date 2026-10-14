## ADDED Requirements

### Requirement: AUD-07 Estado de cuenta exportado
Como única excepción a la regla de AUD-01 de no auditar lecturas, la API SHALL registrar el evento `STATEMENT_EXPORTED` cada vez que entrega un estado de cuenta. El evento lleva actor `USER` con el id del usuario, la cuenta como entidad, el periodo en los metadatos, el `requestId`, la IP y el user agent. El evento MUST NOT contener la CLABE, el nombre del titular ni montos (AUD-02). Si el evento no puede registrarse, la API MUST responder con error y no entregar el documento. Las peticiones rechazadas (404, 422 o 429) MUST NOT registrar el evento. Amplía AUD-01.

#### Scenario: Descarga auditada
- **WHEN** Ana descarga el estado de septiembre de 2026 de su cuenta "Principal"
- **THEN** existe un evento `STATEMENT_EXPORTED` con actor `USER`, el id de Ana, el id de la cuenta y el periodo `2026-09` en los metadatos
- **AND** ningún campo del evento contiene la CLABE ni el nombre de Ana

#### Scenario: Falla al auditar
- **WHEN** el registro del evento falla al generar un estado de cuenta
- **THEN** la API responde 500 y no entrega el documento

#### Scenario: Petición rechazada sin auditoría
- **WHEN** Ana pide el estado de cuenta de una cuenta de Luis
- **THEN** no se agrega ningún evento `STATEMENT_EXPORTED`
