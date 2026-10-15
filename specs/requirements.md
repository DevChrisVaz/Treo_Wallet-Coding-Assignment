# requirements.md

> Este archivo es un **índice**, no el contenido. El proyecto usa OpenSpec de forma nativa
> (`openspec/`): cada cambio tiene su propia propuesta, specs, diseño y tareas, y al archivarse
> sus specs pasan a `openspec/specs/`. Los cuatro archivos de esta carpeta existen para que la
> Fase 1 de la prueba sea fácil de recorrer. Ver [README](README.md).

Historias de usuario con criterios de aceptación en formato EARS (`SHALL`) y escenarios `WHEN/THEN`.
Casos borde: doble clic y doble toque (`transfers` TRF-04, `mobile-app`), pérdida de red a mitad de una transferencia,
redondeo (TRF-08), límite diario que cruza medianoche en CDMX (TRF-12) y transferencia a la propia cuenta (TRF-07).

## Requisitos vigentes (specs principales)

| Capability | Spec |
| --- | --- |
| `accounts` | [openspec/specs/accounts/spec.md](../openspec/specs/accounts/spec.md) |
| `api-contract` | [openspec/specs/api-contract/spec.md](../openspec/specs/api-contract/spec.md) |
| `api-platform` | [openspec/specs/api-platform/spec.md](../openspec/specs/api-platform/spec.md) |
| `audit-trail` | [openspec/specs/audit-trail/spec.md](../openspec/specs/audit-trail/spec.md) |
| `beneficiaries` | [openspec/specs/beneficiaries/spec.md](../openspec/specs/beneficiaries/spec.md) |
| `design-system` | [openspec/specs/design-system/spec.md](../openspec/specs/design-system/spec.md) |
| `identity` | [openspec/specs/identity/spec.md](../openspec/specs/identity/spec.md) |
| `mobile-app` | [openspec/specs/mobile-app/spec.md](../openspec/specs/mobile-app/spec.md) |
| `movement-history` | [openspec/specs/movement-history/spec.md](../openspec/specs/movement-history/spec.md) |
| `transfers` | [openspec/specs/transfers/spec.md](../openspec/specs/transfers/spec.md) |
| `web-app` | [openspec/specs/web-app/spec.md](../openspec/specs/web-app/spec.md) |

## Requisitos por cambio (archivados)

| Cambio | Capability | Spec |
| --- | --- | --- |
| `contract-v1` | `api-contract` | [openspec/changes/archive/2026-10-13-contract-v1/specs/api-contract/spec.md](../openspec/changes/archive/2026-10-13-contract-v1/specs/api-contract/spec.md) |
| `account-statements` | `audit-trail` | [openspec/changes/archive/2026-10-14-account-statements/specs/audit-trail/spec.md](../openspec/changes/archive/2026-10-14-account-statements/specs/audit-trail/spec.md) |
| `account-statements` | `movement-history` | [openspec/changes/archive/2026-10-14-account-statements/specs/movement-history/spec.md](../openspec/changes/archive/2026-10-14-account-statements/specs/movement-history/spec.md) |
| `account-statements` | `web-app` | [openspec/changes/archive/2026-10-14-account-statements/specs/web-app/spec.md](../openspec/changes/archive/2026-10-14-account-statements/specs/web-app/spec.md) |
| `api-foundation` | `accounts` | [openspec/changes/archive/2026-10-14-api-foundation/specs/accounts/spec.md](../openspec/changes/archive/2026-10-14-api-foundation/specs/accounts/spec.md) |
| `api-foundation` | `api-platform` | [openspec/changes/archive/2026-10-14-api-foundation/specs/api-platform/spec.md](../openspec/changes/archive/2026-10-14-api-foundation/specs/api-platform/spec.md) |
| `api-foundation` | `audit-trail` | [openspec/changes/archive/2026-10-14-api-foundation/specs/audit-trail/spec.md](../openspec/changes/archive/2026-10-14-api-foundation/specs/audit-trail/spec.md) |
| `api-foundation` | `identity` | [openspec/changes/archive/2026-10-14-api-foundation/specs/identity/spec.md](../openspec/changes/archive/2026-10-14-api-foundation/specs/identity/spec.md) |
| `api-ledger` | `accounts` | [openspec/changes/archive/2026-10-14-api-ledger/specs/accounts/spec.md](../openspec/changes/archive/2026-10-14-api-ledger/specs/accounts/spec.md) |
| `api-ledger` | `beneficiaries` | [openspec/changes/archive/2026-10-14-api-ledger/specs/beneficiaries/spec.md](../openspec/changes/archive/2026-10-14-api-ledger/specs/beneficiaries/spec.md) |
| `api-ledger` | `movement-history` | [openspec/changes/archive/2026-10-14-api-ledger/specs/movement-history/spec.md](../openspec/changes/archive/2026-10-14-api-ledger/specs/movement-history/spec.md) |
| `api-ledger` | `transfers` | [openspec/changes/archive/2026-10-14-api-ledger/specs/transfers/spec.md](../openspec/changes/archive/2026-10-14-api-ledger/specs/transfers/spec.md) |
| `biometric-unlock` | `mobile-app` | [openspec/changes/archive/2026-10-14-biometric-unlock/specs/mobile-app/spec.md](../openspec/changes/archive/2026-10-14-biometric-unlock/specs/mobile-app/spec.md) |
| `contract-v1-1` | `api-contract` | [openspec/changes/archive/2026-10-14-contract-v1-1/specs/api-contract/spec.md](../openspec/changes/archive/2026-10-14-contract-v1-1/specs/api-contract/spec.md) |
| `contract-v1-2` | `api-contract` | [openspec/changes/archive/2026-10-14-contract-v1-2/specs/api-contract/spec.md](../openspec/changes/archive/2026-10-14-contract-v1-2/specs/api-contract/spec.md) |
| `design-system` | `design-system` | [openspec/changes/archive/2026-10-14-design-system/specs/design-system/spec.md](../openspec/changes/archive/2026-10-14-design-system/specs/design-system/spec.md) |
| `redesign` | `design-system` | [openspec/changes/archive/2026-10-14-redesign/specs/design-system/spec.md](../openspec/changes/archive/2026-10-14-redesign/specs/design-system/spec.md) |
| `redesign` | `mobile-app` | [openspec/changes/archive/2026-10-14-redesign/specs/mobile-app/spec.md](../openspec/changes/archive/2026-10-14-redesign/specs/mobile-app/spec.md) |
| `redesign` | `web-app` | [openspec/changes/archive/2026-10-14-redesign/specs/web-app/spec.md](../openspec/changes/archive/2026-10-14-redesign/specs/web-app/spec.md) |
| `scheduled-transfers` | `audit-trail` | [openspec/changes/archive/2026-10-14-scheduled-transfers/specs/audit-trail/spec.md](../openspec/changes/archive/2026-10-14-scheduled-transfers/specs/audit-trail/spec.md) |
| `scheduled-transfers` | `design-system` | [openspec/changes/archive/2026-10-14-scheduled-transfers/specs/design-system/spec.md](../openspec/changes/archive/2026-10-14-scheduled-transfers/specs/design-system/spec.md) |
| `scheduled-transfers` | `mobile-app` | [openspec/changes/archive/2026-10-14-scheduled-transfers/specs/mobile-app/spec.md](../openspec/changes/archive/2026-10-14-scheduled-transfers/specs/mobile-app/spec.md) |
| `scheduled-transfers` | `transfers` | [openspec/changes/archive/2026-10-14-scheduled-transfers/specs/transfers/spec.md](../openspec/changes/archive/2026-10-14-scheduled-transfers/specs/transfers/spec.md) |
| `scheduled-transfers` | `web-app` | [openspec/changes/archive/2026-10-14-scheduled-transfers/specs/web-app/spec.md](../openspec/changes/archive/2026-10-14-scheduled-transfers/specs/web-app/spec.md) |
| `web-app` | `web-app` | [openspec/changes/archive/2026-10-14-web-app/specs/web-app/spec.md](../openspec/changes/archive/2026-10-14-web-app/specs/web-app/spec.md) |
| `web-redis-sessions` | `web-app` | [openspec/changes/archive/2026-10-14-web-redis-sessions/specs/web-app/spec.md](../openspec/changes/archive/2026-10-14-web-redis-sessions/specs/web-app/spec.md) |
| `email-branding` | `api-platform` | [openspec/changes/archive/2026-10-15-email-branding/specs/api-platform/spec.md](../openspec/changes/archive/2026-10-15-email-branding/specs/api-platform/spec.md) |
| `mobile-app` | `mobile-app` | [openspec/changes/archive/2026-10-15-mobile-app/specs/mobile-app/spec.md](../openspec/changes/archive/2026-10-15-mobile-app/specs/mobile-app/spec.md) |
| `registration-birth-data` | `api-contract` | [openspec/changes/archive/2026-10-15-registration-birth-data/specs/api-contract/spec.md](../openspec/changes/archive/2026-10-15-registration-birth-data/specs/api-contract/spec.md) |
| `registration-birth-data` | `identity` | [openspec/changes/archive/2026-10-15-registration-birth-data/specs/identity/spec.md](../openspec/changes/archive/2026-10-15-registration-birth-data/specs/identity/spec.md) |
| `registration-birth-data` | `web-app` | [openspec/changes/archive/2026-10-15-registration-birth-data/specs/web-app/spec.md](../openspec/changes/archive/2026-10-15-registration-birth-data/specs/web-app/spec.md) |
| `registration-review` | `audit-trail` | [openspec/changes/archive/2026-10-15-registration-review/specs/audit-trail/spec.md](../openspec/changes/archive/2026-10-15-registration-review/specs/audit-trail/spec.md) |
| `registration-review` | `design-system` | [openspec/changes/archive/2026-10-15-registration-review/specs/design-system/spec.md](../openspec/changes/archive/2026-10-15-registration-review/specs/design-system/spec.md) |
| `registration-review` | `identity` | [openspec/changes/archive/2026-10-15-registration-review/specs/identity/spec.md](../openspec/changes/archive/2026-10-15-registration-review/specs/identity/spec.md) |
| `registration-review` | `mobile-app` | [openspec/changes/archive/2026-10-15-registration-review/specs/mobile-app/spec.md](../openspec/changes/archive/2026-10-15-registration-review/specs/mobile-app/spec.md) |
| `registration-review` | `web-app` | [openspec/changes/archive/2026-10-15-registration-review/specs/web-app/spec.md](../openspec/changes/archive/2026-10-15-registration-review/specs/web-app/spec.md) |
| `security-hardening` | `api-contract` | [openspec/changes/archive/2026-10-15-security-hardening/specs/api-contract/spec.md](../openspec/changes/archive/2026-10-15-security-hardening/specs/api-contract/spec.md) |
| `security-hardening` | `api-platform` | [openspec/changes/archive/2026-10-15-security-hardening/specs/api-platform/spec.md](../openspec/changes/archive/2026-10-15-security-hardening/specs/api-platform/spec.md) |
| `security-hardening` | `beneficiaries` | [openspec/changes/archive/2026-10-15-security-hardening/specs/beneficiaries/spec.md](../openspec/changes/archive/2026-10-15-security-hardening/specs/beneficiaries/spec.md) |
| `security-hardening` | `identity` | [openspec/changes/archive/2026-10-15-security-hardening/specs/identity/spec.md](../openspec/changes/archive/2026-10-15-security-hardening/specs/identity/spec.md) |
| `security-hardening` | `mobile-app` | [openspec/changes/archive/2026-10-15-security-hardening/specs/mobile-app/spec.md](../openspec/changes/archive/2026-10-15-security-hardening/specs/mobile-app/spec.md) |
| `security-hardening` | `transfers` | [openspec/changes/archive/2026-10-15-security-hardening/specs/transfers/spec.md](../openspec/changes/archive/2026-10-15-security-hardening/specs/transfers/spec.md) |
| `security-hardening` | `web-app` | [openspec/changes/archive/2026-10-15-security-hardening/specs/web-app/spec.md](../openspec/changes/archive/2026-10-15-security-hardening/specs/web-app/spec.md) |
| `tooling-fixes` | `api-platform` | [openspec/changes/archive/2026-10-15-tooling-fixes/specs/api-platform/spec.md](../openspec/changes/archive/2026-10-15-tooling-fixes/specs/api-platform/spec.md) |
| `tooling-fixes` | `web-app` | [openspec/changes/archive/2026-10-15-tooling-fixes/specs/web-app/spec.md](../openspec/changes/archive/2026-10-15-tooling-fixes/specs/web-app/spec.md) |
| `ux-fixes` | `api-contract` | [openspec/changes/archive/2026-10-15-ux-fixes/specs/api-contract/spec.md](../openspec/changes/archive/2026-10-15-ux-fixes/specs/api-contract/spec.md) |
| `ux-fixes` | `api-platform` | [openspec/changes/archive/2026-10-15-ux-fixes/specs/api-platform/spec.md](../openspec/changes/archive/2026-10-15-ux-fixes/specs/api-platform/spec.md) |
| `ux-fixes` | `identity` | [openspec/changes/archive/2026-10-15-ux-fixes/specs/identity/spec.md](../openspec/changes/archive/2026-10-15-ux-fixes/specs/identity/spec.md) |
| `ux-fixes` | `mobile-app` | [openspec/changes/archive/2026-10-15-ux-fixes/specs/mobile-app/spec.md](../openspec/changes/archive/2026-10-15-ux-fixes/specs/mobile-app/spec.md) |
| `ux-fixes` | `movement-history` | [openspec/changes/archive/2026-10-15-ux-fixes/specs/movement-history/spec.md](../openspec/changes/archive/2026-10-15-ux-fixes/specs/movement-history/spec.md) |
| `ux-fixes` | `transfers` | [openspec/changes/archive/2026-10-15-ux-fixes/specs/transfers/spec.md](../openspec/changes/archive/2026-10-15-ux-fixes/specs/transfers/spec.md) |
| `ux-fixes` | `web-app` | [openspec/changes/archive/2026-10-15-ux-fixes/specs/web-app/spec.md](../openspec/changes/archive/2026-10-15-ux-fixes/specs/web-app/spec.md) |
