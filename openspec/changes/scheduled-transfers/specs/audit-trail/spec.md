## ADDED Requirements

### Requirement: AUD-08 Eventos de las transferencias programadas
El catálogo de AUD-01 SHALL incluir los eventos de transferencias `TRANSFER_SCHEDULED` y `TRANSFER_CANCELLED`. Los eventos `TRANSFER_COMPLETED` y `TRANSFER_FAILED` de una ejecución programada MUST registrarse con actor `SYSTEM`, sin id de actor, y con el id del usuario dueño de la transferencia en los metadatos. La base de datos MUST rechazar cualquier acción fuera del catálogo. Amplía AUD-01.

#### Scenario: Cancelación auditada
- **WHEN** Ana cancela una transferencia programada
- **THEN** existe un evento `TRANSFER_CANCELLED` con actor `USER`, el id de Ana y el `transferId`

#### Scenario: Ejecución con actor de sistema
- **WHEN** el proceso de ejecución completa una transferencia programada de Ana
- **THEN** el evento `TRANSFER_COMPLETED` tiene actor `SYSTEM` y el id de Ana en los metadatos

#### Scenario: Acción fuera del catálogo
- **WHEN** una sentencia intenta insertar en la bitácora una acción que no está en el catálogo
- **THEN** PostgreSQL la rechaza por `ck_audit_log_action`
