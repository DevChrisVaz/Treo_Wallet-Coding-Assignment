## ADDED Requirements

### Requirement: CTR-22 Respuesta 429 en el cierre de sesión
El contrato SHALL declarar la respuesta `429` con `code` `RATE_LIMITED` y el header `Retry-After` en `logout`, con la misma definición que usan las demás operaciones limitadas (PLT-09, IDN-17), y SHALL publicarse como versión menor `1.6.0`. El cliente tipado MUST entregar ese error como el error tipado de CTR-07.

#### Scenario: Logout limitado en el documento
- **WHEN** se lee `openapi.yaml`
- **THEN** la operación `logout` declara la respuesta `429` con `Retry-After`

#### Scenario: Error tipado
- **WHEN** la API responde `429 RATE_LIMITED` a `logout`
- **THEN** el consumidor recibe un error tipado con `code === "RATE_LIMITED"`

#### Scenario: Versión del paquete
- **WHEN** se publica este cambio del contrato
- **THEN** la versión del paquete es `1.6.0`
