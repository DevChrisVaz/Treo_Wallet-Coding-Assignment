## Context

El contrato es la fuente de verdad (CTR-01). El comportamiento de las rutas nuevas se especifica en otros dos changes:
- `account-statements`: HIS-11, HIS-12, AUD-07 y WEB-32.
- `scheduled-transfers`: de TRF-27 a TRF-36.

Este change solo describe su forma en `openapi.yaml` y agrega al paquete lo que necesitan ambos clientes.

## Goals / Non-Goals

**Goals:**
- Describir en `openapi.yaml` los dos bonus antes de escribir código.
- Publicar una sola versión, la 1.2.0, con:
  - los tipos;
  - los validadores;
  - el calendario de la Ciudad de México;
  - la descarga binaria.

**Non-Goals:**
- El comportamiento de la API o de la web; eso está en los changes de cada funcionalidad.
- Editar una transferencia programada: para cambiarla, se cancela y se crea otra.
- Un listado general de transferencias con filtros.

## Decisions

### D1. Lo que se agrega a `openapi.yaml`

**Rutas nuevas:**

| Ruta | Operación | Respuestas |
|---|---|---|
| `GET /accounts/{accountId}/statements/{period}` | `getAccountStatement` (tag `accounts`) | `200 application/pdf` con los headers `Content-Disposition` y `Cache-Control: no-store`; `401`, `404`, `422`, `429`, `500` |
| `GET /transfers/scheduled` | `listScheduledTransfers` (tag `transfers`) | `200 ScheduledTransferList`; `401`, `500` |
| `POST /transfers/{transferId}/cancel` | `cancelTransfer` (tag `transfers`) | `200 Transfer`; `401`, `404`, `409`, `429`, `500` |

- **El parámetro `period`** es un parámetro de ruta llamado `StatementPeriod`:
  - su patrón es `^20[0-9]{2}-(0[1-9]|1[0-2])$`;
  - su descripción es "mes calendario en America/Mexico_City".
- **Por qué `/transfers/scheduled` no choca con `/transfers/{transferId}`:** OpenAPI 3.1 resuelve primero las rutas concretas que las que llevan plantilla, y `transferId` es un UUID.

**Esquemas nuevos y modificados:**

| Esquema | Cambio |
|---|---|
| `ScheduledDate` (nuevo) | `type: string`, `format: date`, `pattern: ^[0-9]{4}-[0-9]{2}-[0-9]{2}$`. Su descripción: fecha calendario en America/Mexico_City |
| `CreateTransferRequest` | Agrega `scheduledFor` (`ScheduledDate`). Es opcional y no entra en `required` |
| `Transfer` | Agrega `scheduledFor` (`[string, 'null']`, `format: date`) y `cancelledAt` (`[string, 'null']`, `format: date-time`). Ambos van en `required` y aceptan nulo, con el mismo estilo que el resto de los campos |
| `TransferStatus` | Agrega `SCHEDULED` y `CANCELLED` |
| `ScheduledTransferList` (nuevo) | `{ items: Transfer[] }` |
| `ProblemCode` | Agrega `TRANSFER_NOT_CANCELLABLE` (409) y `SCHEDULED_LIMIT_REACHED` (422) |
| `FieldErrorCode` | Agrega `DATE_OUT_OF_RANGE` |

También se actualizan estas descripciones:
- `Problem.transferStatus` aplica a `TRANSFER_NOT_PENDING` y a `TRANSFER_NOT_CANCELLABLE`.
- `Transfer.failureReason` ahora dice "al confirmar o al ejecutar una programada".
- `createTransfer` gana un párrafo de programación.
- `confirmTransfer` aclara que una programada pasa a `SCHEDULED` sin mover dinero.

La respuesta 200 del PDF se describe como `type: string` con `contentMediaType: application/pdf`, que es la forma de OpenAPI 3.1 para un cuerpo binario. Si `openapi-typescript` genera un tipo inservible para ella, también se marca `format: binary`. La verificación de los tipos generados muestra cuál funciona.

*Alternativas descartadas:*
- **`GET /transfers?status=SCHEDULED`.** Abriría un listado general con filtros y paginación que nadie necesita. El listado solo cubre las programadas activas, que están limitadas a 20 por usuario (TRF-29).
- **`DELETE /transfers/{id}` para cancelar.** Una cancelada no se borra: conserva su estado y aparece como `CANCELLED` en el comprobante. Un `POST` sobre una acción expresa una transición de estado, igual que `confirm`.
- **Reutilizar `TRANSFER_NOT_PENDING` al cancelar.** El mensaje "Ya no está pendiente" sería confuso para una transferencia en `PENDING_OTP`, que tampoco se puede cancelar.
- **Un estado de cuenta en JSON para que lo dibuje el cliente.** El usuario eligió PDF. Un solo generador en la API sirve hoy a la web y mañana a la app.

### D2. Calendario de la Ciudad de México
`src/validators/dates.ts` exporta dos funciones:
- **`mexicoCityDate(instant: Date): string`**, con `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' })`.
- **`schedulableRange(instant: Date): { min: string; max: string }`**. Suma días a la fecha calendario con aritmética UTC, en lugar de sumar horas al instante.

Ambas reciben el instante como parámetro, así que se prueban sin un reloj falso.

*Alternativas descartadas:*
- **Desplazamiento fijo `UTC-6`.** Es correcto hoy, porque México eliminó el horario de verano en 2022, pero duplica una regla que ya mantiene la base IANA.
- **Una librería de fechas** (date-fns-tz, Luxon). Es una dependencia pesada para dos funciones, y `Intl` existe tanto en Node como en Hermes.

### D3. Formulario de transferencia con fecha
- **`transferForm`** sigue siendo estático. Acepta `scheduledFor` opcional y valida dos cosas:
  - el formato;
  - que la fecha exista en el calendario (`isValidCalendarDate`).

  Es el espejo del patrón del contrato, así que la paridad de CTR-13 se mantiene.
- **`transferFormAt(instant)`** lo extiende con un refinamiento del rango (`DATE_OUT_OF_RANGE`):
  - la web lo usa en el formulario;
  - la API valida el rango en el dominio con su propio `Clock`, porque es una regla de negocio (TRF-27).

*Alternativa descartada:* meter el rango en `transferForm` leyendo `new Date()`. Rompe el determinismo de las pruebas y obliga a usar el reloj del sistema en Hermes.

### D4. Descarga binaria
openapi-fetch admite `parseAs: 'arrayBuffer' | 'blob' | 'stream'`. El middleware de `toProblemError` ya actúa solo sobre las respuestas que no son 2xx, así que no toca un PDF.

La tarea agrega pruebas de CTR-19 con bytes y de un 404 problem+json en la misma ruta. Solo hace un ajuste si esas pruebas muestran que hace falta.

### D5. Versión 1.2.0
Todo es aditivo (D1). Según CTR-02, la versión es menor, y se suben juntos `package.json` e `info.version`.

Agregar valores a un enum de respuesta no está en la lista de cambios incompatibles de CTR-02, pero puede romper los mapas exhaustivos de los consumidores. El README lo dice en su historial de versiones, y `scheduled-transfers` actualiza `/design-tokens` antes de que cualquier consumidor instale 1.2.0.

## Risks / Trade-offs

- **[Riesgo] `Intl` con `timeZone` se comporta distinto según el motor.**
  - Mitigación: las pruebas del paquete corren en Node.
  - La app no usa la programación. CTR-15 solo exige que el paquete cargue en Hermes, y eso ya lo cubre la prueba de humo.
- **[Riesgo] El tipo generado para el cuerpo binario.**
  - Mitigación: la verificación de tipos generados (`check:types`) y una prueba de cliente que compila contra el tipo.
