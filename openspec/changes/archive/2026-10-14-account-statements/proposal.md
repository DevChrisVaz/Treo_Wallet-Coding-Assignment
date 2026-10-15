## Why

El enunciado ofrece como bonus "exportar el estado de cuenta del mes". El usuario lo eligió en PDF con formato completo de montos: es el documento que un cliente espera de su banco y el que se puede guardar o compartir. También demuestra que el ledger cuadra, porque el documento muestra saldo inicial, abonos, cargos y saldo final, conciliados con los asientos.

## What Changes

- **API.** Ruta `GET /accounts/{accountId}/statements/{period}` (`getAccountStatement`):
  - genera en la API el PDF del mes calendario de la Ciudad de México de una cuenta propia;
  - el mes en curso se entrega como parcial;
  - un mes futuro se rechaza.
- **Contenido del documento:**
  - **Encabezado:** marca TreoWallet, titular, cuenta, CLABE completa, periodo y fecha de generación.
  - **Resumen:** saldo inicial, abonos, cargos y saldo final, conciliados con el ledger.
  - **Tabla de movimientos:** en orden cronológico, con columnas separadas de cargo y abono y el saldo de cada movimiento.
  - **Pie de página:** "Página X de Y" y una leyenda de documento informativo.
  - **Formato:** montos en es-MX con símbolo y separadores ("$1,250.50") y la tipografía Work Sans incrustada.
- **Consistencia.** Saldo inicial y movimientos se leen de una misma instantánea de la base, así que una transferencia que se completa mientras se genera el documento no lo descuadra.
- **Límite de tasa.** Máximo 10 estados de cuenta por minuto por usuario.
- **Auditoría.** Evento `STATEMENT_EXPORTED`, con la cuenta y el periodo, sin datos personales. Es la única lectura que se audita: el documento saca de la plataforma datos completos de la cuenta.
- **Web.** En la pantalla de movimientos:
  - selector de mes (el mes en curso y los 12 anteriores) y botón "Descargar PDF";
  - el proxy de lecturas del BFF deja pasar los bytes del PDF y su nombre de archivo.
- **Contrato.** Usa la ruta y la descarga binaria de 1.2.0 (`contract-v1-2`).

**Proyectos que toca:**
- `/api`: módulo de estados de cuenta, migración del catálogo de auditoría y fuentes Work Sans con su licencia;
- `/web`;
- `/docs`.

`/api` gana la dependencia `@devchrisvaz/wallet-design-tokens`, para las etiquetas de los movimientos.

**Historias de usuario:** extiende HU5 (historial de movimientos) con el bonus de estado de cuenta.

## Capabilities

### New Capabilities
<!-- Ninguna. -->

### Modified Capabilities
- `movement-history`: estado de cuenta mensual en PDF (HIS-11) y su contenido y conciliación (HIS-12).
- `audit-trail`: `STATEMENT_EXPORTED` como única lectura auditada (AUD-07).
- `web-app`: descarga del estado de cuenta (WEB-32).

Los changes `api-ledger`, `api-foundation` y `web-app` no están archivados, así que sus requisitos aún no están en `openspec/specs/`. Por eso los requisitos de este change se agregan con IDs nuevos y cada uno indica a cuál amplía, en lugar de usar deltas `MODIFIED`.

## Impact

- **`/api`:**
  - módulo `statements` con su caso de uso, su lector de PostgreSQL y su renderizador de PDF;
  - ruta y límite de tasa nuevos;
  - migración que agrega `STATEMENT_EXPORTED` a `ck_audit_log_action`;
  - dependencias nuevas: un generador de PDF y las fuentes Work Sans (OFL);
  - dependencia de desarrollo nueva: un lector de PDF para las pruebas;
  - CI: el workflow también se dispara con cambios en `design-tokens/**`.
- **`/web`:**
  - la lista blanca del proxy agrega la ruta del estado de cuenta y pasa el cuerpo binario;
  - controles de descarga en la pantalla de movimientos.
- **Interacción con `redesign`:** el rediseño (otra línea de trabajo) cambia la pantalla de movimientos de la web. El control de descarga es un componente aparte y conserva su API, así que se reubica sin reescribirse.
- **Riesgo:** tiempo de generación con meses de miles de movimientos. Hay una prueba de rendimiento con 5,000 movimientos.
