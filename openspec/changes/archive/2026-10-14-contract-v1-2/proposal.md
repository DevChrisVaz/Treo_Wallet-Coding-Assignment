## Why

El usuario eligió tres bonus del enunciado: estado de cuenta mensual (en PDF), transferencias programadas con fecha futura y desbloqueo biométrico en la app. Los dos primeros cambian la API HTTP, y el proyecto es contrato primero: antes de escribir código en `/api` o `/web`, el `openapi.yaml` y el paquete `@devchrisvaz/wallet-contract` deben describir las rutas, los esquemas y los códigos nuevos. Se publican juntos en una sola versión, 1.2.0, para que la API y la web se actualicen una sola vez.

## What Changes

- **Estado de cuenta:** ruta nueva `GET /accounts/{accountId}/statements/{period}` (`getAccountStatement`) que responde `application/pdf`.
- **Transferencias programadas:**
  - `CreateTransferRequest` acepta `scheduledFor` (fecha calendario de la Ciudad de México), que es opcional.
  - `Transfer` agrega `scheduledFor` y `cancelledAt`.
  - `TransferStatus` agrega `SCHEDULED` y `CANCELLED`.
  - Rutas nuevas: `GET /transfers/scheduled` (`listScheduledTransfers`) y `POST /transfers/{transferId}/cancel` (`cancelTransfer`).
  - `ProblemCode` agrega `TRANSFER_NOT_CANCELLABLE` y `SCHEDULED_LIMIT_REACHED`.
  - `FieldErrorCode` agrega `DATE_OUT_OF_RANGE`.
- **Paquete:**
  - Calendario de la Ciudad de México: fecha de un instante y rango programable.
  - El esquema del formulario de transferencia acepta `scheduledFor`, con una variante que valida el rango.
  - El cliente tipado descarga el PDF como bytes o como stream.
- **Versión 1.2.0** del contrato y del paquete. Todo es aditivo; según CTR-02 es una versión menor.

**Proyectos que toca:** `/contract`. La API, la web y la app instalan 1.2.0 dentro de los changes `account-statements` y `scheduled-transfers`.

**Historias de usuario:** ninguna nueva del enunciado. Prepara los bonus de estado de cuenta y de transferencias programadas, que extienden HU5 (historial) y HU4 (transferir).

## Capabilities

### New Capabilities
<!-- Ninguna. -->

### Modified Capabilities
- `api-contract`:
  - el esquema del formulario de transferencia acepta la fecha programada (CTR-13);
  - el paquete expone el calendario de la Ciudad de México (CTR-18);
  - el cliente descarga documentos binarios (CTR-19).

## Impact

- **`/contract`:**
  - `openapi.yaml`;
  - tipos generados;
  - `src/validators` (fechas y formulario de transferencia);
  - pruebas de paridad y de cliente;
  - prueba de humo;
  - README y versión.
- **Consumidores:**
  - `TransferStatus` crece. Un `Record<TransferStatus, …>` exhaustivo en la web o en la app deja de compilar al instalar 1.2.0 hasta que existan las etiquetas nuevas. Por eso `scheduled-transfers` actualiza primero `/design-tokens` con `SCHEDULED` y `CANCELLED` (DSG-18), antes de que cualquier consumidor instale 1.2.0.
  - Agregar valores a un enum de respuesta no está en la lista de cambios incompatibles de CTR-02. Se trata como versión menor y se documenta en el README.
- **Riesgo:** bajo. Ningún campo existente cambia de tipo ni se vuelve obligatorio en una petición.
