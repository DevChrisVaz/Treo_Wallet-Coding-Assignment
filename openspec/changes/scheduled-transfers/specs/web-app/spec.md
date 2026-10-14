## ADDED Requirements

### Requirement: WEB-33 Programar una transferencia
El flujo de transferencia SHALL ofrecer la opción "Cuándo", con dos valores: "Ahora", seleccionado por defecto, y "Programar". "Programar" muestra un campo de fecha limitado al rango programable de la Ciudad de México (de mañana a 90 días). El formulario MUST validar la fecha con el esquema del contrato antes de enviar.

En cada paso del flujo:
- **Revisión:** MUST mostrar "Se enviará el <fecha>" con la fecha en palabras (por ejemplo, "20 de octubre de 2026").
- **Envío:** MUST mandar `scheduledFor` con la misma llave de idempotencia por intento (WEB-17).
- **Resultado `SCHEDULED`:** MUST mostrar "Transferencia programada" con la fecha y un enlace a la página de programadas.
- **Monto mayor a 10000.00:** el paso del código (WEB-18) MUST aparecer igual que en una inmediata y terminar en el resultado programado.
- **Errores** `DATE_OUT_OF_RANGE`, `SCHEDULED_LIMIT_REACHED` y `TOO_LARGE`: MUST mostrarse con el texto del paquete de diseño, junto al campo cuando el error es de un campo.

Amplía WEB-16, WEB-17 y WEB-18.

#### Scenario: Programar una transferencia
- **WHEN** Ana elige "Programar", la fecha 20 de octubre de 2026 y 1000.00 a Luis, revisa y envía
- **THEN** la revisión dice "Se enviará el 20 de octubre de 2026"
- **AND** el resultado dice "Transferencia programada" con la insignia "Programada"

#### Scenario: Rango del campo de fecha
- **WHEN** Ana elige "Programar" el 14 de octubre de 2026
- **THEN** el campo de fecha admite del 15 de octubre de 2026 al 12 de enero de 2027

#### Scenario: Programada mayor al umbral
- **WHEN** Ana programa 15000.00, confirma el código correcto
- **THEN** el resultado muestra "Transferencia programada" y no "Transferencia enviada"

#### Scenario: Doble clic al programar
- **WHEN** Ana hace doble clic en Enviar al programar
- **THEN** la API recibe la misma llave de idempotencia en ambas peticiones y existe una sola programada

#### Scenario: Tope alcanzado
- **WHEN** la API responde 422 `SCHEDULED_LIMIT_REACHED`
- **THEN** la pantalla muestra "Llegaste al máximo de 20 transferencias programadas. Cancela alguna para programar otra."

### Requirement: WEB-34 Página de transferencias programadas
La web SHALL ofrecer en su navegación una página "Programadas" con las transferencias de `listScheduledTransfers`, mediante el proxy de lecturas (la lista blanca agrega `transfers/scheduled`). Cada transferencia muestra la fecha programada, el destino con los últimos 4 dígitos de su CLABE, el monto y el concepto. Sin programadas, la página MUST mostrar el estado vacío "No tienes transferencias programadas".

Cada transferencia ofrece "Cancelar", que funciona así:
- pide confirmación en un diálogo accesible con el monto, el destino y la fecha;
- ejecuta `cancelTransfer` mediante una Server Action (WEB-06 a WEB-08);
- si la cancelación funciona, la transferencia desaparece de la lista y se anuncia "Transferencia cancelada";
- si la API responde 409 `TRANSFER_NOT_CANCELLABLE`, MUST mostrarse su mensaje y la lista MUST volver a cargarse.

El comprobante de una transferencia (WEB-16) MUST mostrar la fecha programada cuando exista, y la insignia de `SCHEDULED` o `CANCELLED`.

#### Scenario: Lista de programadas
- **WHEN** Ana abre "Programadas" con dos transferencias en `SCHEDULED`
- **THEN** la página las muestra en el orden de la API con su fecha, destino, monto y concepto

#### Scenario: Cancelar con confirmación
- **WHEN** Ana pulsa "Cancelar" en una programada y confirma en el diálogo
- **THEN** la web llama a `cancelTransfer` una sola vez y la transferencia desaparece de la lista
- **AND** se anuncia "Transferencia cancelada"

#### Scenario: Desistir de cancelar
- **WHEN** Ana pulsa "Cancelar" y cierra el diálogo con "Volver" o con Escape
- **THEN** la web no llama a `cancelTransfer` y el foco vuelve al botón "Cancelar"

#### Scenario: Ya se ejecutó
- **WHEN** Ana confirma la cancelación de una programada que el proceso acaba de ejecutar
- **THEN** la página muestra "Esta transferencia ya no se puede cancelar." y la lista ya no la incluye

#### Scenario: Sin programadas
- **WHEN** Ana no tiene transferencias programadas
- **THEN** la página muestra "No tienes transferencias programadas"

#### Scenario: Comprobante de una programada
- **WHEN** Ana abre el comprobante de una transferencia programada
- **THEN** el comprobante muestra la fecha programada y la insignia de su estado
