## Purpose

Permitir que el usuario consulte el historial de movimientos de cada una de sus cuentas, filtrado por fecha y tipo y paginado por cursor, con un rendimiento estable aun con cientos de miles de movimientos.

## ADDED Requirements

### Requirement: HIS-01 Historial por cuenta propia
La API SHALL responder `GET /accounts/{accountId}/movements` (`listAccountMovements`) con los movimientos de la cuenta solicitada solo si pertenece al usuario autenticado. Si la cuenta no existe o es de otro usuario, MUST responder 404 `NOT_FOUND`.

#### Scenario: Historial de una cuenta ajena
- **WHEN** Ana consulta los movimientos de una cuenta de Luis
- **THEN** la API responde 404 con `code` `NOT_FOUND`

### Requirement: HIS-02 Solo el dinero que se movió
Cada movimiento del historial SHALL corresponder a un asiento del ledger. Las transferencias en `PENDING_OTP`, `REJECTED`, `FAILED` o `EXPIRED` MUST NOT aparecer en el historial.

#### Scenario: Transferencia rechazada
- **WHEN** Ana intenta una transferencia que se rechaza por saldo insuficiente
- **THEN** el historial de su cuenta no muestra ningún movimiento de esa transferencia

### Requirement: HIS-03 Contenido de un movimiento
Cada movimiento SHALL incluir `id`, `type`, `amount` con signo (negativo para salidas), `balanceAfter`, `concept`, `reference`, `counterparty`, `transferId` y `occurredAt`. El `type` MUST ser uno de `DEPOSIT`, `TRANSFER_IN`, `TRANSFER_OUT`, `OWN_TRANSFER_IN` u `OWN_TRANSFER_OUT`. La contraparte MUST ser nula en los depósitos de la Tesorería, el nombre del remitente en las entradas, el alias del beneficiario en las salidas a terceros y el nombre de la cuenta en los traspasos propios, con los últimos 4 dígitos de su CLABE cuando aplique.

#### Scenario: Salida a un beneficiario
- **WHEN** Ana envía 150.00 a su beneficiario "Luis" desde una cuenta con 1000.00
- **THEN** el historial de esa cuenta muestra un movimiento `TRANSFER_OUT` con `amount` `"-150.00"`, `balanceAfter` `"850.00"` y `counterparty.name` "Luis"

#### Scenario: Traspaso entre cuentas propias
- **WHEN** Ana envía 500.00 de "Principal" a "Ahorro"
- **THEN** "Principal" muestra un movimiento `OWN_TRANSFER_OUT` de `"-500.00"` y "Ahorro" un `OWN_TRANSFER_IN` de `"500.00"`

#### Scenario: Depósito de la Tesorería
- **WHEN** la cuenta recibió un fondeo de la Tesorería
- **THEN** el movimiento es `DEPOSIT` con `counterparty` nulo

### Requirement: HIS-04 Orden y paginación por cursor
La API SHALL devolver los movimientos en orden descendente por `occurredAt` y, en caso de empate, por `id`, paginados por cursor y nunca por desplazamiento. El tamaño de página MUST ser 20 por defecto, con un máximo de 100; `nextCursor` MUST ser nulo en la última página. Recorrer todas las páginas MUST devolver cada movimiento exactamente una vez, aunque se registren movimientos nuevos durante el recorrido.

#### Scenario: Recorrer el historial completo
- **WHEN** se recorre con cursor el historial de una cuenta con 45 movimientos y `limit` 20
- **THEN** se obtienen 3 páginas de 20, 20 y 5 movimientos sin repetidos ni faltantes
- **AND** la última página tiene `nextCursor` nulo

#### Scenario: Movimiento nuevo durante la paginación
- **WHEN** entre la primera y la segunda página se completa una transferencia nueva en la cuenta
- **THEN** la segunda página no repite ni omite movimientos de la primera

#### Scenario: Límite fuera de rango
- **WHEN** se pide `limit` 101
- **THEN** la API responde 422 con `code` `VALIDATION_FAILED`

### Requirement: HIS-05 Cursor ligado a los filtros
El cursor SHALL ser opaco y estar ligado a los filtros con los que se obtuvo. Si se usa con filtros distintos, o si fue alterado, la API MUST responder 400 con `code` `INVALID_CURSOR`.

#### Scenario: Cambio de filtros con el mismo cursor
- **WHEN** se obtiene un cursor filtrando por `TRANSFER_OUT` y se usa filtrando por `DEPOSIT`
- **THEN** la API responde 400 con `code` `INVALID_CURSOR`

#### Scenario: Cursor alterado
- **WHEN** se envía un cursor modificado manualmente
- **THEN** la API responde 400 con `code` `INVALID_CURSOR`

### Requirement: HIS-06 Filtro por fechas en la zona horaria de la Ciudad de México
La API SHALL interpretar `from` y `to` como días calendario completos de `America/Mexico_City`, ambos inclusive, y MUST responder 422 `VALIDATION_FAILED` cuando `from` es posterior a `to`.

#### Scenario: Movimiento de noche
- **WHEN** existe un movimiento a las 23:30 del 2026-09-30 en CDMX (05:30 UTC del 2026-10-01) y se filtra con `from` y `to` igual a `2026-09-30`
- **THEN** el movimiento aparece en el resultado

#### Scenario: Rango invertido
- **WHEN** se filtra con `from` `2026-10-10` y `to` `2026-10-01`
- **THEN** la API responde 422 con `code` `VALIDATION_FAILED`

### Requirement: HIS-07 Filtro por tipo de movimiento
La API SHALL permitir filtrar por uno o varios tipos de movimiento repitiendo el parámetro `type`, y sin el parámetro MUST devolver todos los tipos.

#### Scenario: Dos tipos
- **WHEN** se filtra con `type=TRANSFER_IN&type=DEPOSIT`
- **THEN** el resultado contiene solo movimientos `TRANSFER_IN` y `DEPOSIT`

### Requirement: HIS-08 Últimos movimientos
Sin filtros y con `limit` 20, la API SHALL devolver los 20 movimientos más recientes de la cuenta, que es la consulta que usa la app móvil.

#### Scenario: Últimos 20
- **WHEN** se consulta una cuenta con 60000 movimientos con `limit` 20 y sin filtros
- **THEN** la respuesta contiene los 20 movimientos más recientes en orden descendente

### Requirement: HIS-09 Rendimiento del historial con volumen
Con al menos 100000 movimientos en la base, las consultas del historial (sin filtros, filtradas por un tipo poco frecuente y con un rango de fechas antiguo) SHALL resolverse mediante índices diseñados para ellas, sin ordenar en memoria, y sus planes `EXPLAIN ANALYZE` MUST quedar documentados en el diseño.

#### Scenario: Plan de la consulta sin filtros
- **WHEN** se ejecuta `EXPLAIN ANALYZE` de la primera página del historial de la cuenta con más movimientos
- **THEN** el plan usa un recorrido por índice sobre la cuenta y no contiene un nodo `Sort`

#### Scenario: Plan con un tipo poco frecuente
- **WHEN** se ejecuta `EXPLAIN ANALYZE` filtrando por `DEPOSIT` en esa misma cuenta
- **THEN** el plan usa el índice que incluye el tipo y no contiene un nodo `Sort`

### Requirement: HIS-10 Datos de volumen para desarrollo
El comando `db:seed` SHALL generar al menos 100000 movimientos distribuidos en 12 meses que terminen el día anterior a su ejecución, concentrando alrededor de 60000 en la cuenta "Principal" de la usuaria demo Ana, sin que ningún `balance_after` sea negativo y cumpliendo todas las invariantes del ledger.

#### Scenario: Invariantes después del seed
- **WHEN** se ejecuta `db:seed` sobre una base vacía y migrada
- **THEN** existen al menos 100000 asientos y la suma global es 0
- **AND** ningún `balance_after` de una cuenta USER es negativo
- **AND** el saldo de cada cuenta coincide con su último `balance_after`
- **AND** ningún movimiento del seed pertenece al día actual de `America/Mexico_City`
