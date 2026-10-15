## MODIFIED Requirements

### Requirement: DSG-12 Textos de la interfaz
El paquete SHALL exportar en español de México, con un tono cercano que habla de "tú", el mensaje para cada `ProblemCode` del contrato y las etiquetas de estados y movimientos. Cada mensaje de error MUST explicar qué pasó y, cuando aplique, qué hacer, sin disculpas ni términos técnicos.

#### Scenario: Saldo insuficiente
- **WHEN** un cliente muestra el error `INSUFFICIENT_FUNDS`
- **THEN** el texto es "No tienes saldo suficiente para esta transferencia."

#### Scenario: Código desconocido
- **WHEN** un cliente recibe un `code` que el paquete no conoce
- **THEN** muestra el mensaje de `INTERNAL_ERROR`

#### Scenario: Registro en revisión
- **WHEN** un cliente muestra el error `REGISTRATION_IN_REVIEW`
- **THEN** el texto es "Tu registro está en revisión. Te escribiremos a tu correo cuando terminemos."
