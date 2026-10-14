Requiere `contract-v1-2` (paquete 1.2.0). La tarea 1.1 va antes de que cualquier consumidor instale 1.2.0. La parte de la API (grupo 2) se implementa después de integrar `account-statements`, porque ambas migraciones recrean `ck_audit_log_action`.

## 1. Sistema de diseño

- [x] 1.1 [design-tokens] Estados `SCHEDULED` ("Programada", tono informativo) y `CANCELLED` ("Cancelada", tono neutro), mensajes de `TRANSFER_NOT_CANCELLABLE` y `SCHEDULED_LIMIT_REACHED`, prueba de que la lista de estados cubre los siete valores de `TransferStatus` de 1.2.0 y versión 1.1.0 (DSG-18)

## 2. API

- [x] 2.1 [api] Instalar el contrato 1.2.0 y el paquete de diseño 1.1.0; migración de `transfers` (`scheduled_for`, `cancelled_at`, estados, `ck_transfers_scheduled_has_date`, `ck_transfers_cancelled_at_by_status`, índices parciales) con `down` protegido; pruebas de las constraints por nombre (TRF-34)
- [x] 2.2 [api] Migración de `ck_audit_log_action` con `TRANSFER_SCHEDULED` y `TRANSFER_CANCELLED` (conservando `STATEMENT_EXPORTED`) y catálogo del dominio; prueba de la acción fuera del catálogo (AUD-08)
- [x] 2.3 [api] Dominio: transiciones nuevas de la máquina de estados (válidas e inválidas), huella con fecha solo cuando existe (vector inmediato fijo) y rango programable con `Clock`, con pruebas unitarias (TRF-27, TRF-29, TRF-34)
- [x] 2.4 [api] Programar hasta el umbral: validación de fecha y del monto mayor al límite, `SCHEDULED` sin tocar saldo ni límite, eventos `TRANSFER_CREATED` y `TRANSFER_SCHEDULED`, reintento y llave reutilizada con otra fecha; pruebas de integración (TRF-27, TRF-29, TRF-36)
- [x] 2.5 [api] Tope de 20 programadas activas con el bloqueo del usuario, sin consumir la llave; pruebas de la programada 21 y de dos programaciones simultáneas con 19 activas (TRF-29)
- [x] 2.6 [api] Programar arriba del umbral: `PENDING_OTP` con fecha y correo con la fecha; confirmación a `SCHEDULED` sin revalidar; doble confirmación; vencida; confirmación después de medianoche (TRF-28, TRF-36)
- [x] 2.7 [api] `ScheduledTransferRunner.runOnce` con el orden global de bloqueos, `SKIP LOCKED`, servicio de ejecución compartido con `createTransfer`, `COMPLETED` o `FAILED` con su motivo, actor `SYSTEM`, ejecución atrasada y cruce de medianoche; pruebas de integración con reloj falso (TRF-30, TRF-36, AUD-08)
- [x] 2.8 [api] Concurrencia: dos ejecutores sobre 50 vencidas con conciliación, y ejecutor contra transferencias manuales de la misma cuenta sin deadlocks (TRF-31)
- [x] 2.9 [api] Correo de falla después del `COMMIT`; prueba del contenido en Mailpit y de la falla del envío sin revertir `FAILED` (TRF-35)
- [x] 2.10 [api] Ruta `cancelTransfer`: `CANCELLED` con `cancelledAt`, doble cancelación, 409 con `transferStatus`, 404 ajena, evento `TRANSFER_CANCELLED` y carrera con el ejecutor con dos conexiones y una barrera (TRF-32, TRF-36, AUD-08)
- [x] 2.11 [api] Ruta `listScheduledTransfers` con orden, exclusión de los demás estados y aislamiento por usuario (TRF-33)
- [x] 2.12 [api] Programadas fuera del historial y del límite; `getTransfer` con `scheduledFor` y `cancelledAt`; conformidad de las respuestas con el contrato (TRF-34)
- [x] 2.13 [api] El ejecutor en el arranque: configuración validada (`SCHEDULER_ENABLED`, `SCHEDULER_INTERVAL_MS`, `SCHEDULER_BATCH_SIZE`), una pasada a la vez, apagado ordenado con `SIGTERM`; prueba de la falla de auditoría que deja la transferencia en `SCHEDULED` para la siguiente pasada (TRF-30, TRF-36)
- [x] 2.14 [api] README: transferencias programadas, configuración del ejecutor, concurrencia y cómo verlas ejecutarse en local (TRF-30, TRF-31)

## 3. Web

- [x] 3.1 [web] Instalar el contrato 1.2.0 y el paquete de diseño 1.1.0; insignias de los estados nuevos y comprobante con la fecha programada; las pruebas vigentes siguen pasando (WEB-34)
- [ ] 3.2 [web] Selector "Cuándo" con el rango de `schedulableRange`, validación con `transferFormAt`, revisión con la fecha en palabras, envío de `scheduledFor` con la misma llave, resultado programado (también con OTP) y errores por código; pruebas de componentes y del doble clic (WEB-33)
- [ ] 3.3 [web] Lista blanca con `transfers/scheduled` y Server Action `cancelTransfer` (origen, validación y resultado como valor); pruebas (WEB-34, WEB-06, WEB-07, WEB-08, WEB-09)
- [ ] 3.4 [web] Página "Programadas" en la navegación: lista, estado vacío, diálogo de cancelación accesible, anuncio, 409 con recarga de la lista; pruebas de componentes, teclado y `axe` (WEB-34)
- [ ] 3.5 [web] README de la web con la programación y la página de programadas (WEB-33, WEB-34)

## 4. Móvil

- [x] 4.1 [mobile] Instalar el contrato 1.2.0 y el paquete de diseño 1.1.0; prueba de la insignia "Programada" en el resultado y de que el flujo no ofrece fecha; las pruebas vigentes siguen pasando (MOB-23)

## 5. Verificación

- [ ] 5.1 [docs] Verificación manual contra la API real: programar desde la web una transferencia menor y otra mayor al umbral, cancelar una y ver ejecutarse otra con el procedimiento del README; comprobar estados, asientos y auditoría en la base (TRF-27, TRF-28, TRF-30, TRF-32, WEB-33, WEB-34)
