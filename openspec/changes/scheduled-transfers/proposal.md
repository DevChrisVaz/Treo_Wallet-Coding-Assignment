## Why

El enunciado ofrece como bonus las transferencias programadas con fecha futura y el usuario lo eligió. Es el bonus que más prueba el núcleo del sistema. Una transferencia programada se ejecuta sin el usuario, en otro momento, y debe hacerlo exactamente una vez, aunque corran varias instancias de la API o el usuario la cancele en el mismo segundo. Al ejecutarse debe respetar el ledger, el límite diario del día de ejecución y el orden de bloqueos ya acordado.

## What Changes

- **Programar.** `POST /transfers` acepta `scheduledFor`, una fecha de la Ciudad de México que va de mañana a 90 días.
  - Hasta 10,000.00, la transferencia queda en `SCHEDULED`.
  - Arriba de 10,000.00, primero se confirma con OTP y luego queda en `SCHEDULED`.
  - No se aparta dinero: el saldo y el límite se validan al ejecutar.
- **Ejecución.** Un proceso dentro de la API revisa cada minuto qué transferencias vencieron. Desde las 00:00 de la Ciudad de México de su fecha, ejecuta cada transferencia en `SCHEDULED` una sola vez, con los mismos bloqueos y validaciones que una transferencia inmediata.
  - El resultado es `COMPLETED` o `FAILED`, con su motivo.
  - Si falla, el usuario recibe un correo.
  - Si la API no estuvo disponible a medianoche, se ejecuta en la siguiente pasada.
- **Cancelar.** `POST /transfers/{transferId}/cancel` mientras la transferencia está en `SCHEDULED`; una cancelada queda en `CANCELLED`. No hay edición: para cambiar una programada se cancela y se crea otra.
- **Consultar.** `GET /transfers/scheduled` devuelve las programadas activas del usuario. Cada usuario puede tener como máximo 20 programadas activas.
- **Idempotencia.** Las reglas existentes aplican a la programación, y la fecha forma parte del contenido comparado.
- **Auditoría.** Eventos nuevos `TRANSFER_SCHEDULED` y `TRANSFER_CANCELLED`. La ejecución se audita con actor `SYSTEM`.
- **Sistema de diseño.** Estados `SCHEDULED` ("Programada") y `CANCELLED` ("Cancelada") y los textos de los códigos nuevos.
- **Web.**
  - En el flujo de transferencia, la opción "Ahora" o "Programar" con su fecha.
  - Una página "Programadas" con cancelación.
  - El comprobante muestra la fecha programada.
- **Móvil.** Instala el contrato 1.2.0 y muestra los estados nuevos con las etiquetas del sistema de diseño. La app no ofrece programar.

**Proyectos que toca:** `/design-tokens`, `/api`, `/web`, `/mobile` y `/docs`. El contrato ya está en 1.2.0 (`contract-v1-2`).

**Historias de usuario:** extiende HU4 (transferir) con el bonus de transferencias programadas. Toca HU5 (historial) solo para confirmar que las programadas no aparecen hasta ejecutarse.

## Capabilities

### New Capabilities
<!-- Ninguna. -->

### Modified Capabilities
- `transfers`: requisitos TRF-27 a TRF-36.
  - programación y programación con OTP;
  - idempotencia y tope de programadas;
  - ejecución y ejecución única;
  - cancelación y consulta;
  - estados nuevos;
  - aviso de falla y auditoría.
- `audit-trail`: eventos nuevos del catálogo (AUD-08).
- `design-system`: estados y textos de las programadas (DSG-18).
- `web-app`: programar en el flujo de transferencia (WEB-33) y página de programadas (WEB-34).
- `mobile-app`: estados nuevos del contrato en la app (MOB-23).

Los changes de esas capabilities no están archivados, así que este change agrega requisitos con IDs nuevos que indican a cuál amplían, en lugar de deltas `MODIFIED`.

## Impact

- **`/api`:**
  - migración de `transfers`: `scheduled_for`, `cancelled_at`, estados, constraints e índices parciales;
  - migración del catálogo de auditoría;
  - máquina de estados;
  - huella de idempotencia, que se mantiene estable para las transferencias inmediatas;
  - casos de uso de programar, confirmar, cancelar, listar y ejecutar;
  - proceso de ejecución en el arranque, con apagado ordenado;
  - correo de falla;
  - configuración `SCHEDULER_ENABLED` y `SCHEDULER_INTERVAL_MS`.
- **`/design-tokens`:** versión 1.1.0 con dos estados y dos textos.
- **`/web`:** flujo de transferencia, página nueva, lista blanca del proxy, Server Action de cancelación y comprobante.
- **`/mobile`:** reinstalación de los paquetes y etiquetas.
- **AWS (documentado en `delivery`):**
  - con varias tareas de Fargate, el proceso corre en todas y `FOR UPDATE SKIP LOCKED` evita la doble ejecución;
  - la alternativa es EventBridge Scheduler, que invocaría un endpoint interno o una tarea.
- **Interacción con `redesign`:** el rediseño cambia el flujo de transferencia de la web y la navegación. Los controles nuevos (selector "Ahora o Programar" y página de programadas) son componentes aparte. La fase de aplicación del rediseño debe incorporarlos.
- **Riesgo:** la concurrencia entre ejecución, cancelación y transferencias manuales del mismo usuario. Se mitiga con el orden global de bloqueos y con pruebas de dos ejecutores y de carreras con la cancelación.
