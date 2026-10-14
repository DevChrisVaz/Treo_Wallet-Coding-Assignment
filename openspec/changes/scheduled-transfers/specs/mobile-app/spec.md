## ADDED Requirements

### Requirement: MOB-23 Estados de las programadas en la app
La app SHALL usar el contrato 1.2.0 y el paquete de diseño con los estados `SCHEDULED` y `CANCELLED`. Si recibe una transferencia en uno de esos estados, SHALL mostrarla con la etiqueta y el tono del paquete de diseño, sin tratarla como error. La app MUST NOT ofrecer programar ni cancelar transferencias: esas funciones son solo de la web en este alcance. Amplía MOB-13.

#### Scenario: Transferencia programada en el resultado
- **WHEN** la app muestra el resultado de una transferencia cuyo estado es `SCHEDULED`
- **THEN** la insignia dice "Programada" con el tono informativo y no se muestra un mensaje de error

#### Scenario: Sin opción de programar
- **WHEN** el usuario abre el flujo de transferencia en la app
- **THEN** no existe ningún control para elegir una fecha de envío
