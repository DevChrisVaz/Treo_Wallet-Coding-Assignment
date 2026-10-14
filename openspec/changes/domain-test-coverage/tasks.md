Cada tarea agrega o corrige pruebas sin tocar código de producción. Cada prueba nueva se demuestra con una mutación (D1): se rompe la regla, se ve la prueba en rojo, se restaura el archivo, y el cuerpo del commit dice qué mutación la hace fallar.

## 1. Transferencias inmediatas

- [ ] 1.1 [api] Reintento de `POST /transfers` con la misma llave después de confirmar el OTP: 200 COMPLETED con el mismo id y sin mover dinero otra vez (TRF-03)
- [ ] 1.2 [api] Una transferencia hecha por la API deja exactamente dos asientos, −X y +X, con su `transferId`; la referencia con letras responde `VALIDATION_FAILED` (TRF-21, TRF-09)
- [ ] 1.3 [api] Una transferencia mayor al umbral que excede el límite diario se rechaza al crearla con `DAILY_LIMIT_EXCEEDED`, sin emitir código ni enviar correo (TRF-11, TRF-14)
- [ ] 1.4 [api] Repetición con la misma llave de un rechazo `DAILY_LIMIT_EXCEEDED` (con `remaining` recalculado) y de una transferencia FAILED (200 con estado FAILED) (TRF-03, TRF-11)
- [ ] 1.5 [api] La llave de idempotencia es por usuario: dos usuarios con la misma llave crean dos transferencias independientes (TRF-02, TRF-03)
- [ ] 1.6 [api] Reversión cuando falla la auditoría de `TRANSFER_OTP_SENT`, `OTP_ATTEMPT_FAILED`/`OTP_ATTEMPTS_EXHAUSTED` (el contador de intentos también se revierte), `TRANSFER_FAILED` y `TRANSFER_OTP_RESENT` (TRF-25)
- [ ] 1.7 [api] Bordes de validación: referencia de más de 7 dígitos y concepto de exactamente 40 caracteres contados por punto de código (TRF-09)
- [ ] 1.8 [api] Bajo el bloqueo se vuelve a comprobar que el destino propio pertenece al usuario y que el de un beneficiario es una cuenta de usuario (TRF-06)

## 2. Transferencias programadas

- [ ] 2.1 [api] El tope de 20 programadas se revisa antes de emitir el OTP: una programada mayor al umbral en el tope responde `SCHEDULED_LIMIT_REACHED` sin código ni correo (TRF-29, TRF-28)
- [ ] 2.2 [api] Una programada de exactamente 10,000.00 queda SCHEDULED sin OTP (TRF-28)
- [ ] 2.3 [api] Confirmar una programada cancelada responde 409 `TRANSFER_NOT_PENDING`; confirmar una ya ejecutada responde 200 (TRF-28, TRF-32)
- [ ] 2.4 [api] Cuando todo un lote falla, el ejecutor sigue después del último candidato y no repite el lote (TRF-30, TRF-31)
- [ ] 2.5 [api] Reversión cuando falla la auditoría al programar, al confirmar con OTP y al cancelar (TRF-36, AUD-08)
- [ ] 2.6 [api] Si el aviso de falla lanza un error, el ejecutor lo registra y sigue con las demás (TRF-35)
- [ ] 2.7 [api] La barrera de la carrera del tope de programadas falla si las peticiones no llegan juntas (TRF-29)

## 3. Identidad y sesiones

- [ ] 3.1 [api] Después del reenvío por `/auth/register`, el código anterior deja de servir y el nuevo correo trae un código válido (IDN-01, IDN-05)
- [ ] 3.2 [api] El reuso fuera de la ventana revoca también los tokens ya usados de la familia; el reuso cuando el sucesor ya se usó responde `SESSION_REVOKED` y audita `REFRESH_TOKEN_REUSE_DETECTED` (IDN-12, AUD-01)
- [ ] 3.3 [api] Ventana de gracia: exactamente 30 s todavía es reintento y se mide desde el primer uso; un sucesor ya revocado dentro de la ventana es reuso (IDN-12)
- [ ] 3.4 [api] Un token válido de un usuario que ya no existe responde 401 `UNAUTHENTICATED`; el logout con un refresh token vencido responde 204 (IDN-10, IDN-13)
- [ ] 3.5 [api] Registrar un email sin verificar después del límite de reenvíos no envía correo; dos registros simultáneos con el mismo email nuevo dejan un solo usuario (IDN-01, IDN-03, IDN-07)
- [ ] 3.6 [api] Un email ya verificado recibe exactamente la misma respuesta que un código incorrecto; se auditan `OTP_ATTEMPTS_EXHAUSTED` de la verificación de email y `LOGIN_FAILED` con `EMAIL_NOT_VERIFIED` (IDN-06, IDN-08, AUD-01)
- [ ] 3.7 [api] Vector de CURP con fecha 00-02-29 que distingue 1900 de 2000; el código vence exactamente a los 15 minutos (IDN-02, IDN-05)

## 4. Cuentas, beneficiarios y auditoría

- [ ] 4.1 [api] Después del reintento de un alta, el usuario tiene exactamente un beneficiario con esa CLABE (BEN-07)
- [ ] 4.2 [api] Si falla la auditoría de `BENEFICIARY_CREATED`, el alta se revierte (BEN-11)
- [ ] 4.3 [api] El límite disponible del día usa el `limit_cents` guardado en la fila del día y no el valor de la configuración (ACC-11)
- [ ] 4.4 [api] La metadata de auditoría rechaza `name`, `fullName`, `token`, `accessToken` y `refreshToken`, sin importar mayúsculas (AUD-02)

## 5. Historial y estado de cuenta

- [x] 5.1 [api] Con 60000 movimientos, la primera página sin filtros trae los 20 más recientes en orden descendente (HIS-08)
- [ ] 5.2 [api] Una transferencia confirmada durante la generación del estado de cuenta no aparece en él y el resumen cuadra, a través del caso de uso completo (HIS-12)
- [ ] 5.3 [api] Un cursor firmado cuyo cuerpo no es JSON o trae una fecha inexistente responde `INVALID_CURSOR`; los filtros de fecha de un solo lado devuelven el rango abierto (HIS-05, HIS-06)
- [ ] 5.4 [api] El saldo inicial con varios asientos en el mismo instante antes del periodo; el límite de 10 descargas por minuto también cuenta las peticiones rechazadas (HIS-11, HIS-12)
- [x] 5.5 [api] La consulta con un rango de fechas antiguo usa su índice sin ordenar en memoria (HIS-09)

## 6. Constraints de la base de datos

- [ ] 6.1 [api] Cuentas: `ck_accounts_clabe_by_type` (SYSTEM con CLABE), `ck_accounts_type`, `ck_accounts_name_length`, `fk_accounts_user` y privilegios de `wallet_app` (ACC-01, ACC-03, ACC-06)
- [ ] 6.2 [api] Beneficiarios: `uq_beneficiaries_user_clabe`, `uq_beneficiaries_user_alias`, `ck_beneficiaries_name_length`, `ck_beneficiaries_alias_trimmed`, sus FK y privilegios (BEN-07, BEN-08)
- [ ] 6.3 [api] Transferencias y uso diario: los CHECK y FK de `transfers` y `ck_daily_transfer_usage_within_limit`, `_non_negative` y `_limit_positive` (TRF-07, TRF-08, TRF-13, TRF-34)
- [ ] 6.4 [api] Asientos y auditoría: `ck_ledger_entries_type`, `ck_ledger_entries_amount_nonzero`, `uq_ledger_entries_transfer_account`, exactamente dos asientos por transferencia y `ck_audit_log_metadata_object` (TRF-21, TRF-22, AUD-04)

## 7. Contrato y paridad de reglas

- [ ] 7.1 [contract] CURP con fecha 00-02-29 que distingue el siglo, RFC que no coincide con la CURP y día 00 en fechas (CTR-10, CTR-11, CTR-13)
- [ ] 7.2 [contract] Validadores de formularios: alias, nombre completo, longitudes de contraseña, email de más de 254 caracteres, UUID inválido, destino OWN_ACCOUNT y tipo de destino desconocido (CTR-12, CTR-13)
- [ ] 7.3 [contract] `ApiError` expone `detail`, `remaining`, `attemptsRemaining`, `type` e `instance`; un cuerpo problem+json ilegible cae en `INTERNAL_ERROR` (CTR-07)
- [ ] 7.4 [api] CLABE, CURP y RFC dan el mismo resultado en la API y en el contrato sobre los mismos vectores (CTR-09, CTR-10, CTR-11, ACC-05, IDN-02)

## 8. Cierre

- [ ] 8.1 [docs] Bitácora de AI, conteo final de escenarios cubiertos y cobertura de `/api` y `/contract`
