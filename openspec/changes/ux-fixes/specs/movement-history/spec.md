## MODIFIED Requirements

### Requirement: HIS-03 Contenido de un movimiento
Cada movimiento SHALL incluir `id`, `type`, `amount` con signo (negativo para salidas), `balanceAfter`, `concept`, `reference`, `counterparty`, `transferId` y `occurredAt`. El `type` MUST ser uno de `DEPOSIT`, `TRANSFER_IN`, `TRANSFER_OUT`, `OWN_TRANSFER_IN` u `OWN_TRANSFER_OUT`. La contraparte MUST ser nula en los depósitos de la Tesorería, el nombre del remitente en las entradas, el alias del beneficiario en las salidas a terceros y el nombre de la cuenta en los traspasos propios, con los últimos 4 dígitos de su CLABE cuando aplique. La referencia MUST ser nula cuando la transferencia se hizo sin referencia y en los depósitos de la Tesorería.

#### Scenario: Salida a un beneficiario
- **WHEN** Ana envía 150.00 a su beneficiario "Luis" desde una cuenta con 1000.00
- **THEN** el historial de esa cuenta muestra un movimiento `TRANSFER_OUT` con `amount` `"-150.00"`, `balanceAfter` `"850.00"` y `counterparty.name` "Luis"

#### Scenario: Traspaso entre cuentas propias
- **WHEN** Ana envía 500.00 de "Principal" a "Ahorro"
- **THEN** "Principal" muestra un movimiento `OWN_TRANSFER_OUT` de `"-500.00"` y "Ahorro" un `OWN_TRANSFER_IN` de `"500.00"`

#### Scenario: Depósito de la Tesorería
- **WHEN** la cuenta recibió un fondeo de la Tesorería
- **THEN** el movimiento es `DEPOSIT` con `counterparty` nulo

#### Scenario: Movimiento sin referencia
- **WHEN** Ana envía 150.00 a su beneficiario "Luis" sin indicar una referencia
- **THEN** el movimiento trae `reference` igual a `null`
- **AND** si la indicó, el movimiento trae su texto

### Requirement: HIS-11 Estado de cuenta mensual en PDF
La API SHALL responder `GET /accounts/{accountId}/statements/{period}` (`getAccountStatement`) con el estado de cuenta en PDF del mes `period` (`YYYY-MM`, mes calendario de `America/Mexico_City`) de una cuenta del usuario autenticado, con `Content-Type: application/pdf`, `Cache-Control: no-store` y `Content-Disposition: attachment; filename="estado-de-cuenta-<period>-<últimos 4 dígitos de la CLABE>.pdf"`. Si la cuenta no existe o es de otro usuario, MUST responder 404 `NOT_FOUND`. Un periodo con formato inválido MUST responder 422 `VALIDATION_FAILED`. Un periodo posterior al mes en curso, o anterior al mes de apertura de la cuenta (`Account.createdAt`, en `America/Mexico_City`), MUST responder 422 `VALIDATION_FAILED` con el error en `/period` y el código `DATE_OUT_OF_RANGE`, sin auditar la descarga. El mes de apertura y el mes en curso MUST permitirse. El mes en curso MUST cubrir desde su primer día hasta el momento de la generación, identificado en el documento como parcial. La API MUST limitar la generación a 10 estados de cuenta por minuto por usuario y responder `429 RATE_LIMITED` con `Retry-After` al excederlo (PLT-09). Amplía HIS-01.

#### Scenario: Estado de cuenta de un mes cerrado
- **WHEN** Ana pide el estado de septiembre de 2026 de su cuenta "Principal" con CLABE terminada en 0015, abierta en agosto de 2026
- **THEN** la API responde 200 con `Content-Type: application/pdf` y un cuerpo que empieza con `%PDF-`
- **AND** `Content-Disposition` propone el nombre `estado-de-cuenta-2026-09-0015.pdf`

#### Scenario: Cuenta ajena
- **WHEN** Ana pide el estado de cuenta de una cuenta de Luis
- **THEN** la API responde 404 con `code` `NOT_FOUND`
- **AND** también cuando el periodo es anterior a la apertura de esa cuenta

#### Scenario: Mes futuro
- **WHEN** el 14 de octubre de 2026 se pide el periodo `2026-11`
- **THEN** la API responde 422 con `code` `VALIDATION_FAILED`

#### Scenario: Mes anterior a la apertura de la cuenta
- **WHEN** Ana abrió su cuenta el 3 de agosto de 2026 y pide el periodo `2026-07`
- **THEN** la API responde 422 con `code` `VALIDATION_FAILED` y un error en `/period` con el código `DATE_OUT_OF_RANGE`
- **AND** no se registra ninguna descarga en la bitácora

#### Scenario: Mes de apertura
- **WHEN** Ana abrió su cuenta el 3 de agosto de 2026 y pide el periodo `2026-08`
- **THEN** la API responde 200 con el estado de cuenta de agosto

#### Scenario: Cuenta abierta de noche
- **WHEN** la cuenta se abrió a las 23:30 del 31 de agosto de 2026 en la Ciudad de México (05:30 UTC del 1 de septiembre)
- **THEN** su mes de apertura es agosto de 2026 y la API acepta el periodo `2026-08`

#### Scenario: Periodo con formato inválido
- **WHEN** se pide el periodo `2026-13`
- **THEN** la API responde 422 con `code` `VALIDATION_FAILED`

#### Scenario: Mes en curso
- **WHEN** el 14 de octubre de 2026 a las 12:00 en la Ciudad de México se pide el periodo `2026-10`
- **THEN** el documento cubre del 1 al 14 de octubre de 2026 y lo identifica como periodo parcial

#### Scenario: Demasiadas descargas
- **WHEN** el mismo usuario pide 11 estados de cuenta en menos de un minuto
- **THEN** la petición 11 responde 429 con `code` `RATE_LIMITED` y `Retry-After`

### Requirement: HIS-12 Contenido y conciliación del estado de cuenta
El estado de cuenta SHALL contener:
- **Encabezado:** la marca TreoWallet, el nombre del titular, el nombre de la cuenta, la CLABE completa, el periodo y la fecha y hora de generación en `America/Mexico_City`.
- **Resumen:** el saldo inicial (el `balanceAfter` del último movimiento anterior al periodo, o 0.00 si no hay), el total de abonos, el total de cargos y el saldo final.
- **Tabla de movimientos:** un renglón por cada movimiento del periodo, en orden ascendente por fecha y, en caso de empate, por identificador. Cada renglón lleva:
  - la fecha y hora en `America/Mexico_City`;
  - la etiqueta del tipo de movimiento;
  - el concepto;
  - la contraparte;
  - la referencia, solo cuando el movimiento la tiene;
  - el monto en la columna de cargo o en la de abono, sin signo;
  - el saldo posterior.

El documento MUST cumplir estas reglas:
- **Conciliación:** el saldo inicial más los abonos menos los cargos MUST ser igual al saldo final, y el saldo final MUST ser el `balanceAfter` del último movimiento del periodo, o el saldo inicial si no hubo movimientos.
- **Montos:** MUST escribirse en formato es-MX con símbolo y separadores de miles, sin floats ni redondeo.
- **Páginas:** cada página MUST repetir los encabezados de la tabla y mostrar "Página X de Y" y la leyenda "Documento informativo; no es un comprobante fiscal."
- **Mes sin movimientos:** el documento MUST mostrar el resumen y el texto "Sin movimientos en el periodo".
- **Instantánea:** el saldo inicial y los movimientos MUST leerse de una misma instantánea de la base de datos.
- **Sin referencia:** un renglón de un movimiento sin referencia MUST NOT mostrar "null", "0" ni la palabra "Referencia".

#### Scenario: Conciliación del periodo
- **WHEN** una cuenta cerró agosto de 2026 con 1000.00 y en septiembre recibió 500.00 y envió 150.00
- **THEN** el estado de septiembre muestra saldo inicial "$1,000.00", abonos "$500.00", cargos "$150.00" y saldo final "$1,350.00"
- **AND** la tabla tiene 2 renglones en orden cronológico

#### Scenario: Movimiento de noche
- **WHEN** existe un movimiento a las 23:30 del 30 de septiembre de 2026 en la Ciudad de México (05:30 UTC del 1 de octubre)
- **THEN** aparece en el estado de septiembre y no en el de octubre

#### Scenario: Mes sin movimientos
- **WHEN** se pide el estado de un mes en el que la cuenta no tuvo movimientos y su saldo era 250.00
- **THEN** el documento muestra saldo inicial y final "$250.00", abonos y cargos "$0.00" y el texto "Sin movimientos en el periodo"

#### Scenario: Formato de montos
- **WHEN** el periodo tiene un abono de 1250.5
- **THEN** su renglón muestra "$1,250.50" en la columna de abono y la columna de cargo vacía

#### Scenario: Mes con muchos movimientos
- **WHEN** se pide el estado de un mes con 5000 movimientos
- **THEN** la tabla tiene 5000 renglones repartidos en varias páginas, cada una con los encabezados de la tabla
- **AND** la última página muestra "Página N de N", con N igual al total de páginas
- **AND** la respuesta llega en menos de 5 segundos en el entorno local

#### Scenario: Transferencia durante la generación
- **WHEN** una transferencia de la cuenta se completa después de leer el saldo inicial y antes de leer los movimientos
- **THEN** el documento no la incluye y su resumen cuadra

#### Scenario: Movimiento sin referencia
- **WHEN** el periodo tiene una transferencia sin referencia y otra con la referencia `1234567`
- **THEN** el renglón de la primera no imprime "null" ni "Referencia"
- **AND** el de la segunda sí imprime su referencia
