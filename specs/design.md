# design.md

> Este archivo es un **índice**, no el contenido. El proyecto usa OpenSpec de forma nativa
> (`openspec/`): cada cambio tiene su propia propuesta, specs, diseño y tareas, y al archivarse
> sus specs pasan a `openspec/specs/`. Los cuatro archivos de esta carpeta existen para que la
> Fase 1 de la prueba sea fácil de recorrer. Ver [README](README.md).

Cada cambio tiene su `design.md`. Dónde está cada tema pedido en la Fase 1:

| Tema | Dónde |
| --- | --- |
| Modelo de datos (ER en Mermaid) | [api-foundation](../openspec/changes/archive/2026-10-14-api-foundation/design.md), [api-ledger](../openspec/changes/archive/2026-10-14-api-ledger/design.md) |
| Contrato OpenAPI 3.1 | [contract/openapi.yaml](../contract/openapi.yaml) |
| Concurrencia e idempotencia | [api-ledger](../openspec/changes/archive/2026-10-14-api-ledger/design.md) (bloqueos en orden determinista, por qué no `SERIALIZABLE`) |
| Autenticación | [api-foundation](../openspec/changes/archive/2026-10-14-api-foundation/design.md) |
| Manejo de errores (RFC 9457 / 7807) | [api-foundation](../openspec/changes/archive/2026-10-14-api-foundation/design.md), spec `api-platform` |
| Dónde TypeORM no alcanza | [api-ledger](../openspec/changes/archive/2026-10-14-api-ledger/design.md), [api-foundation](../openspec/changes/archive/2026-10-14-api-foundation/design.md) |
| `EXPLAIN ANALYZE` con 120,128 asientos | [api-ledger](../openspec/changes/archive/2026-10-14-api-ledger/design.md) (sección "EXPLAIN ANALYZE") |
| Mapa de pantallas y estados, web | [web-app](../openspec/changes/archive/2026-10-14-web-app/design.md) |
| Mapa de pantallas y estados, móvil | [mobile-app](../openspec/changes/archive/2026-10-15-mobile-app/design.md) |

## Todos los diseños

| Cambio | Fecha | Diseño |
| --- | --- | --- |
| `contract-v1` | 2026-10-13 | [openspec/changes/archive/2026-10-13-contract-v1/design.md](../openspec/changes/archive/2026-10-13-contract-v1/design.md) |
| `account-statements` | 2026-10-14 | [openspec/changes/archive/2026-10-14-account-statements/design.md](../openspec/changes/archive/2026-10-14-account-statements/design.md) |
| `api-foundation` | 2026-10-14 | [openspec/changes/archive/2026-10-14-api-foundation/design.md](../openspec/changes/archive/2026-10-14-api-foundation/design.md) |
| `api-ledger` | 2026-10-14 | [openspec/changes/archive/2026-10-14-api-ledger/design.md](../openspec/changes/archive/2026-10-14-api-ledger/design.md) |
| `biometric-unlock` | 2026-10-14 | [openspec/changes/archive/2026-10-14-biometric-unlock/design.md](../openspec/changes/archive/2026-10-14-biometric-unlock/design.md) |
| `contract-v1-1` | 2026-10-14 | [openspec/changes/archive/2026-10-14-contract-v1-1/design.md](../openspec/changes/archive/2026-10-14-contract-v1-1/design.md) |
| `contract-v1-2` | 2026-10-14 | [openspec/changes/archive/2026-10-14-contract-v1-2/design.md](../openspec/changes/archive/2026-10-14-contract-v1-2/design.md) |
| `design-system` | 2026-10-14 | [openspec/changes/archive/2026-10-14-design-system/design.md](../openspec/changes/archive/2026-10-14-design-system/design.md) |
| `domain-test-coverage` | 2026-10-14 | [openspec/changes/archive/2026-10-14-domain-test-coverage/design.md](../openspec/changes/archive/2026-10-14-domain-test-coverage/design.md) |
| `redesign` | 2026-10-14 | [openspec/changes/archive/2026-10-14-redesign/design.md](../openspec/changes/archive/2026-10-14-redesign/design.md) |
| `scheduled-transfers` | 2026-10-14 | [openspec/changes/archive/2026-10-14-scheduled-transfers/design.md](../openspec/changes/archive/2026-10-14-scheduled-transfers/design.md) |
| `web-app` | 2026-10-14 | [openspec/changes/archive/2026-10-14-web-app/design.md](../openspec/changes/archive/2026-10-14-web-app/design.md) |
| `web-redis-sessions` | 2026-10-14 | [openspec/changes/archive/2026-10-14-web-redis-sessions/design.md](../openspec/changes/archive/2026-10-14-web-redis-sessions/design.md) |
| `delivery` | 2026-10-15 | [openspec/changes/archive/2026-10-15-delivery/design.md](../openspec/changes/archive/2026-10-15-delivery/design.md) |
| `email-branding` | 2026-10-15 | [openspec/changes/archive/2026-10-15-email-branding/design.md](../openspec/changes/archive/2026-10-15-email-branding/design.md) |
| `mobile-app` | 2026-10-15 | [openspec/changes/archive/2026-10-15-mobile-app/design.md](../openspec/changes/archive/2026-10-15-mobile-app/design.md) |
| `registration-birth-data` | 2026-10-15 | [openspec/changes/archive/2026-10-15-registration-birth-data/design.md](../openspec/changes/archive/2026-10-15-registration-birth-data/design.md) |
| `registration-review` | 2026-10-15 | [openspec/changes/archive/2026-10-15-registration-review/design.md](../openspec/changes/archive/2026-10-15-registration-review/design.md) |
| `security-hardening` | 2026-10-15 | [openspec/changes/archive/2026-10-15-security-hardening/design.md](../openspec/changes/archive/2026-10-15-security-hardening/design.md) |
| `tooling-fixes` | 2026-10-15 | [openspec/changes/archive/2026-10-15-tooling-fixes/design.md](../openspec/changes/archive/2026-10-15-tooling-fixes/design.md) |
| `ux-fixes` | 2026-10-15 | [openspec/changes/archive/2026-10-15-ux-fixes/design.md](../openspec/changes/archive/2026-10-15-ux-fixes/design.md) |
