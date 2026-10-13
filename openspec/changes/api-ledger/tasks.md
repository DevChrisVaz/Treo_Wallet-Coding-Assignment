## 1. Dominio: dinero, tiempo y estados

- [ ] 1.1 [api] Value object `Money` con `cents: bigint`: `parse` desde string decimal (0 a 2 decimales, sin ceros a la izquierda, máximo 12 dígitos enteros, mayor que cero) por manipulación de strings, `toDecimalString` con 2 decimales, suma, resta y comparación (TRF-08)
- [ ] 1.2 [api] Pruebas unitarias de `Money` con los vectores de la exploración: `"1250.5"`, `"1250.50"`, `"0.01"`, `"100.005"`, `"0.00"`, `"-5.00"`, `"1,250.50"`, `"1e3"`, `" 10.00"`, `".50"`, `"007.00"`, 13 dígitos enteros (TRF-08)
- [ ] 1.3 [api] Utilidades de día de negocio en `America/Mexico_City`: día calendario de un instante, inicio del día siguiente en UTC y rango UTC de un intervalo de fechas inclusivo, con pruebas en las 17:59, 18:00, 23:59 y 00:00 de CDMX (TRF-12, ACC-11, HIS-06)
- [ ] 1.4 [api] Máquina de estados de la transferencia como función pura (estado + evento → estado o error) y estado `EXPIRED` calculado por vigencia, con pruebas de todas las transiciones válidas e inválidas (TRF-14, TRF-16, TRF-17, TRF-18, TRF-19)
- [ ] 1.5 [api] Fingerprint SHA-256 sobre la serialización canónica de los valores interpretados, con prueba de que `"100.5"` y `"100.50"` producen el mismo fingerprint y un monto distinto no (TRF-04)
- [ ] 1.6 [api] Variables de configuración validadas al arrancar: `DAILY_TRANSFER_LIMIT`, `OTP_THRESHOLD`, `OTP_TTL_SECONDS`, `OTP_MAX_ATTEMPTS`, `OTP_MAX_RESENDS`, `CURSOR_SIGNING_SECRET`, con sus valores por defecto en `.env.example` (TRF-11, TRF-14, TRF-19, TRF-20, HIS-05)

## 2. Migraciones del ledger

- [ ] 2.1 [api] Migración de `beneficiaries` con `uq_beneficiaries_user_clabe`, `uq_beneficiaries_user_alias`, `ck_beneficiaries_clabe_valid`, constraints de nombre y alias, llaves foráneas con nombre, grants `SELECT, INSERT` para `wallet_app` y `down` (BEN-08)
- [ ] 2.2 [api] Migración de `transfers` con todas sus constraints con nombre (`uq_transfers_user_idempotency_key`, `ck_transfers_distinct_accounts`, `ck_transfers_amount_positive`, `ck_transfers_reference_range`, `ck_transfers_concept_trimmed` y las de consistencia por tipo y estado), grants `SELECT, INSERT, UPDATE` y `down` (TRF-02, TRF-07, TRF-09)
- [ ] 2.3 [api] Migración de `ledger_entries` con `uq_ledger_entries_transfer_account`, `ck_ledger_entries_amount_nonzero`, `ck_ledger_entries_type`, índices `ix_ledger_entries_account_created` e `ix_ledger_entries_account_type_created`, grants `SELECT, INSERT` y `down` (TRF-21, HIS-09)
- [ ] 2.4 [api] Triggers diferidos `tg_ledger_entries_zero_sum` (2 asientos, suma 0, transferencia `COMPLETED`) y `tg_transfers_completed_has_entries`, lanzando `check_violation` con el nombre de la constraint (TRF-21)
- [ ] 2.5 [api] Triggers `tg_ledger_entries_immutable` y `tg_ledger_entries_no_truncate` (TRF-23)
- [ ] 2.6 [api] Migración de `daily_transfer_usage` con `pk_daily_transfer_usage`, `ck_daily_transfer_usage_within_limit`, `ck_daily_transfer_usage_non_negative`, grants `SELECT, INSERT, UPDATE` y `down` (TRF-11, TRF-13)
- [ ] 2.7 [api] Pruebas de integración de la base: inserción directa de asientos desbalanceados rechazada al `COMMIT`, transferencia `COMPLETED` sin asientos rechazada, `ck_transfers_distinct_accounts` y `ck_beneficiaries_clabe_valid` activos (TRF-21, TRF-07, BEN-08)
- [ ] 2.8 [api] Pruebas de privilegios: `UPDATE`, `DELETE` y `TRUNCATE` sobre `ledger_entries` como `wallet_app` fallan con `42501`, y `DELETE` como dueño falla por el trigger (TRF-23)
- [ ] 2.9 [api] Registrar en el traductor de errores las constraints de este change según la tabla del diseño (sección 12), con pruebas de cada mapeo (TRF-07, TRF-10, TRF-11, BEN-07)

## 3. Servicio de asientos y fondeo

- [ ] 3.1 [api] Servicio de asientos que, dentro de una transacción con cuentas ya bloqueadas, inserta los dos asientos con su tipo y `balance_after`, actualiza saldos y completa la transferencia (TRF-21, TRF-22)
- [ ] 3.2 [api] Fondeo desde la Tesorería con el servicio de asientos (kind `FUNDING`, movimiento `DEPOSIT`, evento `FUNDING_POSTED` con actor `SYSTEM` en la misma transacción) (ACC-15)
- [ ] 3.3 [api] Script `npm run db:fund -- --account <id|clabe> --amount <monto>` sobre el servicio de fondeo, con validación del monto por `Money.parse` y error sin escrituras si es inválido (ACC-15)
- [ ] 3.4 [api] Consultas de conciliación (saldo = suma de asientos, suma global cero, cadena de `balance_after`) como helper de pruebas, con prueba de integración tras fondear y transferir (ACC-14, TRF-22)
- [ ] 3.5 [api] Prueba de integración: el fondeo deja la Tesorería en negativo sin violar constraints y nunca se expone por HTTP (ACC-15)

## 4. Cuentas

- [ ] 4.1 [api] Caso de uso y endpoint `GET /accounts` (`listAccounts`): cuentas USER del usuario con `balance` y `currency`, sin la Tesorería (ACC-10, ACC-13)
- [ ] 4.2 [api] `dailyLimit` en `GET /accounts` leyendo la fila contador del día de CDMX (o 0), con `remaining`, `resetsAt` y `timeZone` (ACC-11)
- [ ] 4.3 [api] Endpoint `GET /accounts/{accountId}` (`getAccount`) con 404 idéntico para cuenta inexistente, ajena o SYSTEM (ACC-12, ACC-16)
- [ ] 4.4 [api] Pruebas de integración de cuentas: dos cuentas con saldos correctos, 401 sin token, 404 ajena, `dailyLimit` con transferencias propias excluidas y `resetsAt` correcto con `Clock` fijo, saldo intacto con una transferencia `PENDING_OTP` (ACC-10, ACC-11, ACC-12, ACC-13)

## 5. Beneficiarios

- [ ] 5.1 [api] Esquema Zod de `CreateBeneficiaryRequest` con errores por JSON Pointer (BEN-02)
- [ ] 5.2 [api] Cadena de validación en el orden de BEN-06: dígito verificador, código de banco, cuenta USER existente y cuenta propia, con sus códigos de error (BEN-03, BEN-04, BEN-05, BEN-06)
- [ ] 5.3 [api] Caso de uso de alta con idempotencia por contenido y resolución de `23505` por relectura (200 o 409), auditoría `BENEFICIARY_CREATED` en la misma transacción solo en altas nuevas (BEN-01, BEN-07, BEN-11)
- [ ] 5.4 [api] Endpoints `POST /beneficiaries` y `GET /beneficiaries` ordenado por alias, con rate limit de 10 altas por hora por usuario (BEN-01, BEN-09, BEN-10)
- [ ] 5.5 [api] Pruebas unitarias de la cadena de validación, incluida la CLABE con suma múltiplo de 10 y el orden de errores (BEN-03, BEN-06)
- [ ] 5.6 [api] Pruebas de integración de beneficiarios: alta, 17 dígitos, número JSON, dígito incorrecto, otro banco, CLABE sin cuenta, cuenta propia, reintento idéntico (200 mismo `id`), conflicto por CLABE y por alias, alta concurrente duplicada, listado aislado por usuario, 429 en el undécimo intento y evento de auditoría sin datos personales (BEN-01, BEN-02, BEN-03, BEN-04, BEN-05, BEN-07, BEN-08, BEN-09, BEN-10, BEN-11)

## 6. Transferencias: creación

- [ ] 6.1 [api] Esquema Zod de `CreateTransferRequest` (unión discriminada del destino, monto solo string, concepto y referencia) y validación del header `Idempotency-Key` (400 `IDEMPOTENCY_KEY_MISSING` / `IDEMPOTENCY_KEY_INVALID`) (TRF-02, TRF-08, TRF-09)
- [ ] 6.2 [api] Resolución del destino y de la propiedad antes de la transacción (beneficiario del usuario → `account_id`, cuenta propia, Tesorería excluida), con 404 sin consumir la llave, y `kind` derivado en el servidor (TRF-06, TRF-07, ACC-16)
- [ ] 6.3 [api] Reclamo de la llave con `INSERT … ON CONFLICT ON CONSTRAINT uq_transfers_user_idempotency_key DO NOTHING RETURNING` y rama de reintento: relectura, comparación de fingerprint, 200 con estado actual y `Idempotent-Replayed: true`, mismo 422 si fue rechazada o `IDEMPOTENCY_KEY_REUSED` (TRF-03, TRF-04)
- [ ] 6.4 [api] Bloqueos en orden global: fila contador (solo `THIRD_PARTY`), cuentas `ORDER BY id FOR NO KEY UPDATE` con propiedad en la misma sentencia, hora tomada después de los bloqueos y reintento único si el día cambió durante la espera (TRF-06, TRF-12, TRF-13, TRF-24)
- [ ] 6.5 [api] Validaciones de negocio bajo bloqueo y rechazo persistido como `REJECTED` con motivo, 422 con `transferId` (y `remaining` en límite) y evento `TRANSFER_REJECTED` (TRF-10, TRF-11, TRF-25)
- [ ] 6.6 [api] Camino inmediato (monto ≤ umbral): asientos, saldos, contador, `COMPLETED`, eventos `TRANSFER_CREATED` y `TRANSFER_COMPLETED` en la misma transacción, respuesta 201 (TRF-01, TRF-21, TRF-22, TRF-25)
- [ ] 6.7 [api] Endpoint `POST /transfers` (`createTransfer`) que solo traduce HTTP y delega en el caso de uso (TRF-01)
- [ ] 6.8 [api] Pruebas de integración de creación: a beneficiario y a cuenta propia, saldo exacto, saldo insuficiente con `REJECTED` y saldo intacto, misma cuenta (422), monto `"100.005"`, número JSON, `"0.00"` y `"1250.5"` → 125050 centavos, referencia con letras, sin llave, la validación no consume la llave (TRF-01, TRF-02, TRF-07, TRF-08, TRF-09, TRF-10)
- [ ] 6.9 [api] Pruebas de integración de idempotencia: doble envío (una transferencia, 200 con `Idempotent-Replayed`), respuesta perdida y reintento, rechazo reintentado tras fondear (mismo 422), llave con otro monto (422 `IDEMPOTENCY_KEY_REUSED`), `"100.5"` contra `"100.50"` (TRF-03, TRF-04)
- [ ] 6.10 [api] Pruebas de integración IDOR: origen ajeno, `OWN_ACCOUNT` ajena, beneficiario ajeno y Tesorería como destino responden 404 sin cambiar saldos (TRF-06, ACC-16)
- [ ] 6.11 [api] Pruebas de integración del límite: llegar exactamente a 50,000.00, excederlo con `remaining`, cuentas propias sin consumo, cruce de medianoche (23:59 → 00:01 de CDMX con `Clock` controlado), medianoche UTC sin reinicio (17:00 → 18:30 de CDMX) y reintento cuando el día cambia mientras se espera el bloqueo (TRF-11, TRF-12)
- [ ] 6.12 [api] Pruebas de auditoría: eventos de creación y completado con monto y sin datos personales, y reversión completa si el insert de auditoría falla (TRF-25)

## 7. Transferencias: OTP

- [ ] 7.1 [api] Camino con OTP (monto > umbral, también entre cuentas propias): `PENDING_OTP` sin asientos, `one_time_codes` con propósito `TRANSFER_CONFIRMATION`, `otp_expires_at`, eventos `TRANSFER_CREATED` y `TRANSFER_OTP_SENT`, respuesta con `requiresOtp` y `otp` (TRF-14, TRF-25)
- [ ] 7.2 [api] Correo del OTP enviado después del `COMMIT` con código, monto en es-MX, nombre del destino y últimos 4 dígitos de la CLABE; `deliveryStatus` `FAILED` si el envío falla, sin código en respuesta, logs ni auditoría (TRF-15)
- [ ] 7.3 [api] Confirmación `POST /transfers/{transferId}/confirm` (`confirmTransfer`): bloqueos contador → transferencia → cuentas, idempotente por estado, 409 si no está pendiente o venció, validación del código, revalidación de saldo y límite, `COMPLETED` o `FAILED` con motivo y eventos (TRF-16, TRF-17, TRF-18, TRF-19, TRF-25)
- [ ] 7.4 [api] Reenvío `POST /transfers/{transferId}/otp/resend` (`resendTransferOtp`): máximo 3, invalida el código anterior, reinicia intentos y vigencia, evento `TRANSFER_OTP_RESENT`, 409 y 422 según el caso (TRF-20, TRF-25)
- [ ] 7.5 [api] Pruebas de integración del umbral: 15,000.00 queda `PENDING_OTP` con saldo intacto, exactamente 10,000.00 se completa, 12,000.00 entre cuentas propias pide OTP (TRF-14, ACC-13)
- [ ] 7.6 [api] Pruebas de integración del correo contra Mailpit: el mensaje contiene monto, destino y últimos 4 dígitos; la respuesta y los logs no contienen el código; con SMTP caído responde 201 con `FAILED` (TRF-15)
- [ ] 7.7 [api] Pruebas de integración de confirmación: éxito, saldo gastado mientras esperaba (`FAILED` + `INSUFFICIENT_FUNDS`), código incorrecto con `attemptsRemaining`, tercer intento (`OTP_ATTEMPTS_EXHAUSTED`), dos confirmaciones simultáneas (dos asientos en total), reintento tras respuesta perdida sin consumir intentos, 409 `TRANSFER_NOT_PENDING` con `transferStatus` (TRF-16, TRF-17, TRF-18)
- [ ] 7.8 [api] Pruebas de integración de vencimiento y medianoche: confirmar a los 6 minutos (409 `TRANSFER_EXPIRED`, consulta muestra `EXPIRED`) y OTP creado a las 23:58 confirmado a las 00:02 que consume el límite del día nuevo (TRF-19, TRF-12)
- [ ] 7.9 [api] Pruebas de integración de reenvío: el código anterior deja de servir y el cuarto reenvío responde `RESEND_LIMIT_REACHED` (TRF-20)

## 8. Transferencias: consulta

- [ ] 8.1 [api] Endpoint `GET /transfers/{transferId}` (`getTransfer`) como comprobante, con `destination.displayName`, `clabeLast4`, estado `EXPIRED` calculado y 404 para transferencias de otros usuarios (TRF-26, TRF-19)
- [ ] 8.2 [api] Pruebas de integración del comprobante propio y del 404 ajeno (TRF-26)

## 9. Historial de movimientos

- [ ] 9.1 [api] Esquema Zod de los filtros (`from`, `to`, `type` múltiple, `limit` 1 a 100 con 20 por defecto) con 422 si `from` es posterior a `to` (HIS-04, HIS-06, HIS-07)
- [ ] 9.2 [api] Cursor opaco `base64url` con `{t, id, f}` firmado con HMAC-SHA256 y verificación de firma y hash de filtros (400 `INVALID_CURSOR`), con pruebas unitarias de cursor alterado y filtros distintos (HIS-05)
- [ ] 9.3 [api] Consulta keyset con comparación de filas, `LIMIT + 1`, rango UTC de fechas de CDMX, filtro de tipos y resolución de la contraparte según el tipo (HIS-01, HIS-02, HIS-03, HIS-04, HIS-06, HIS-07)
- [ ] 9.4 [api] Endpoint `GET /accounts/{accountId}/movements` (`listAccountMovements`) con 404 para cuentas ajenas (HIS-01, HIS-08)
- [ ] 9.5 [api] Pruebas de integración del historial: cuenta ajena, rechazadas y pendientes ausentes, salida a beneficiario con `balanceAfter`, traspaso propio en ambas cuentas, depósito con contraparte nula, 45 movimientos en 3 páginas sin repetidos, movimiento nuevo durante la paginación, `limit` 101, movimiento de las 23:30 de CDMX dentro de su día, rango invertido, filtro de dos tipos y últimos 20 (HIS-01, HIS-02, HIS-03, HIS-04, HIS-06, HIS-07, HIS-08)

## 10. Concurrencia

- [ ] 10.1 [api] Prueba de concurrencia: cuenta fondeada con 1,000.00 y 100 transferencias simultáneas de 15.00 a un tercero con llaves distintas → 66 `COMPLETED`, 34 `REJECTED`, saldo exactamente 10.00, suma global 0, uso diario 990.00 y conciliación completa (TRF-24, TRF-10, ACC-14)
- [ ] 10.2 [api] Prueba de concurrencia: 10 peticiones simultáneas con la misma llave → una transferencia, dos asientos y 10 respuestas con el mismo `id` (TRF-05)
- [ ] 10.3 [api] Prueba de concurrencia: transferencias cruzadas Ana ↔ Luis repetidas en paralelo sin errores `40P01` y con saldos conciliados (TRF-24)
- [ ] 10.4 [api] Prueba de concurrencia: 8,000.00 desde "Principal" y 8,000.00 desde "Ahorro" al mismo tiempo con 40,000.00 usados → exactamente una completada y uso de 48,000.00 (TRF-13)

## 11. Seed de volumen y planes de ejecución

- [ ] 11.1 [api] Seed de usuarios demo (Ana, Luis y ~50 generados) verificados, con CURP, RFC y teléfono sintéticos válidos y sus dos cuentas, beneficiarios ya registrados para Ana (al menos Luis, que la app móvil necesita para transferir) y fondeo inicial desde la Tesorería con `FUNDING_POSTED` (HIS-10, ACC-15, BEN-01)
- [ ] 11.2 [api] Generación de ~60k transferencias completadas (~120k asientos) por lotes con `generate_series`, 12 meses que terminan ayer a las 23:59 de CDMX, ~60k asientos en "Principal" de Ana y `balance_after` calculado en staging con función de ventana antes de insertar (HIS-10)
- [ ] 11.3 [api] Ajuste de saldos al último `balance_after`, `ANALYZE` y verificación de invariantes al final del seed que falla si alguna no se cumple, más prueba de integración del seed en pequeño (HIS-10, ACC-14)
- [ ] 11.4 [api] Ejecutar `npm run db:seed` completo, capturar `EXPLAIN (ANALYZE, BUFFERS)` de las tres consultas del historial y pegarlo en la sección "EXPLAIN ANALYZE" de `design.md`, verificando uso de índice y ausencia de `Sort` (HIS-09)
- [ ] 11.5 [api] Prueba automatizada de planes: `EXPLAIN` (sin `ANALYZE`) de las consultas sin filtro y con `DEPOSIT` usa el índice esperado y no contiene `Sort` (HIS-09)
- [ ] 11.6 [api] Documentar en el README de `/api` los comandos `db:seed` y `db:fund`, las credenciales demo, el tiempo medido del seed y las consultas de conciliación (ACC-14, ACC-15, HIS-10)

## 12. Contrato

- [ ] 12.1 [api] Verificar que las pruebas de integración de este change pasan por la validación Ajv de respuestas contra `contract/openapi.yaml` en todos los endpoints nuevos, incluidas las respuestas 200 de reintento y los 422 con extensiones (ACC-10, BEN-01, TRF-03, HIS-03)
