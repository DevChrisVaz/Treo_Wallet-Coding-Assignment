## ADDED Requirements

### Requirement: DSG-18 Estados y textos de las transferencias programadas
El paquete SHALL exportar, como datos y con las mismas reglas de DSG-10 y DSG-12:
- el tono y la etiqueta de `SCHEDULED`: tono informativo, "Programada";
- el tono y la etiqueta de `CANCELLED`: tono neutro, "Cancelada";
- los mensajes de los códigos `TRANSFER_NOT_CANCELLABLE` y `SCHEDULED_LIMIT_REACHED`.

La lista de estados del paquete MUST cubrir todos los valores de `TransferStatus` del contrato 1.2.0. El paquete MUST publicarse como versión menor. Amplía DSG-10 y DSG-12.

#### Scenario: Transferencia programada
- **WHEN** se muestra una transferencia en `SCHEDULED`
- **THEN** su insignia usa el tono informativo y la etiqueta "Programada"

#### Scenario: Transferencia cancelada
- **WHEN** se muestra una transferencia en `CANCELLED`
- **THEN** su insignia usa el tono neutro y la etiqueta "Cancelada"

#### Scenario: Tope de programadas
- **WHEN** un cliente muestra el error `SCHEDULED_LIMIT_REACHED`
- **THEN** el mensaje es "Llegaste al máximo de 20 transferencias programadas. Cancela alguna para programar otra."

#### Scenario: Ya no se puede cancelar
- **WHEN** un cliente muestra el error `TRANSFER_NOT_CANCELLABLE`
- **THEN** el mensaje es "Esta transferencia ya no se puede cancelar."
