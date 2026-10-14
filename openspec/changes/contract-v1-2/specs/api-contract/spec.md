## MODIFIED Requirements

### Requirement: CTR-13 Esquemas de formularios alineados con el contrato
El paquete SHALL exportar esquemas de validación reutilizables en el cliente y en el servidor para los formularios de registro, verificación de correo, inicio de sesión, alta de beneficiario y transferencia, incluido el destino como unión discriminada (`OWN_ACCOUNT` o `BENEFICIARY`) y la fecha programada opcional (`scheduledFor`). Para cada patrón del contrato, el validador del paquete MUST aceptar y rechazar exactamente los mismos vectores de prueba que el esquema correspondiente de `openapi.yaml`. El esquema del formulario de transferencia MUST tener una variante que, dado el instante actual, rechace una fecha programada fuera del rango programable de CTR-18 con el código por campo `DATE_OUT_OF_RANGE`.

#### Scenario: Paridad con el contrato
- **WHEN** se evalúan los vectores de prueba de monto, CLABE, CURP, RFC, teléfono, concepto, referencia y fecha programada contra el validador del paquete y contra el esquema del contrato
- **THEN** ambos aceptan y rechazan los mismos vectores

#### Scenario: Destino inválido
- **WHEN** el formulario de transferencia trae un destino con `type` `OWN_ACCOUNT` y un `beneficiaryId`
- **THEN** el esquema lo rechaza

#### Scenario: Errores por campo
- **WHEN** el formulario de transferencia tiene el monto `"100.005"` y el concepto vacío
- **THEN** el resultado identifica ambos campos con un código de error por campo

#### Scenario: Fecha programada imposible
- **WHEN** el formulario de transferencia trae `scheduledFor` `"2026-02-30"`
- **THEN** el esquema la rechaza en `/scheduledFor` con `INVALID_DATE`

#### Scenario: Fecha programada fuera de rango
- **WHEN** el instante actual es 2026-10-14 12:00 en la Ciudad de México y el formulario trae `scheduledFor` `"2026-10-14"` o `"2027-01-13"`
- **THEN** la variante con rango lo rechaza en `/scheduledFor` con `DATE_OUT_OF_RANGE`
- **AND** acepta `"2026-10-15"` y `"2027-01-12"`

## ADDED Requirements

### Requirement: CTR-18 Calendario de la Ciudad de México en el paquete
El paquete SHALL exportar una función que devuelve la fecha calendario (`YYYY-MM-DD`) de un instante en `America/Mexico_City` y otra que devuelve el rango programable: desde el día siguiente a la fecha actual hasta 90 días después de ella, ambos inclusive. Ambas MUST recibir el instante como parámetro, sin leer el reloj del sistema, y MUST funcionar en Node.js y en el motor JavaScript de React Native (CTR-15).

#### Scenario: Instante de noche
- **WHEN** se pide la fecha de 2026-10-01T05:30:00Z (23:30 del 30 de septiembre en la Ciudad de México)
- **THEN** la función devuelve `"2026-09-30"`

#### Scenario: Rango programable
- **WHEN** se pide el rango para 2026-10-14T18:00:00Z
- **THEN** el rango es de `"2026-10-15"` a `"2027-01-12"`

#### Scenario: Cambio de año
- **WHEN** se pide el rango para 2026-12-31T23:00:00Z (17:00 del 31 de diciembre en la Ciudad de México)
- **THEN** el rango empieza en `"2027-01-01"`

### Requirement: CTR-19 Descarga de documentos binarios
El cliente tipado SHALL permitir obtener la respuesta `application/pdf` de `getAccountStatement` como bytes o como stream, sin intentar interpretarla como JSON. Una respuesta de error en esa misma ruta MUST llegar como el error tipado de CTR-07.

#### Scenario: PDF como bytes
- **WHEN** la API responde 200 con `Content-Type: application/pdf` y un cuerpo que empieza con `%PDF-`
- **THEN** el consumidor recibe los mismos bytes, que empiezan con `%PDF-`

#### Scenario: Error al pedir el PDF
- **WHEN** la API responde 404 `application/problem+json` con `code` `NOT_FOUND` en esa ruta
- **THEN** el consumidor recibe un error tipado con `code === "NOT_FOUND"`
