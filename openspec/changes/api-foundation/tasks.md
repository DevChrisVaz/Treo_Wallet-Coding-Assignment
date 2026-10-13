## 1. Andamiaje del proyecto

- [x] 1.1 [api] Crear el proyecto `/api`: `package.json` con `engines.node >= 20`, TypeScript en modo estricto, `.npmrc` con `install-links=true`, dependencia `@devchrisvaz/wallet-contract` con `file:../contract` y scripts `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:unit`, `test:integration`, `db:bootstrap`, `db:migrate`, `db:revert`, `db:seed` (PLT-13)
- [x] 1.2 [api] Crear la estructura `modules/{identity,accounts,audit}/{domain,application,infrastructure}` y `platform/`, la raíz de composición con inyección manual y la regla de lint de imports por capa, con un archivo de prueba de lint que demuestre que importar Express o TypeORM desde `domain` falla (PLT-18)
- [x] 1.3 [api] Validar la configuración al arrancar con un schema sobre `process.env` (secretos ≥ 256 bits, códigos de banco y plaza de 3 dígitos, URLs) y agregar `.env.example`; pruebas de arranque fallido sin revelar valores (PLT-08)
- [x] 1.4 [api] Agregar `docker-compose.yml` con PostgreSQL 16 y Mailpit (SMTP 1025, bandeja 8025) (PLT-13)

## 2. Base de datos: roles, migraciones y garantías

- [x] 2.1 [api] Escribir `db/bootstrap.sql` idempotente (roles `wallet_migrator` y `wallet_app`, bases `wallet` y `wallet_test`, schema `app`, revocaciones de `PUBLIC`, `search_path`) y el script `db:bootstrap` con `psql` y contraseñas por variables (PLT-14)
- [x] 2.2 [api] Configurar los DataSources `app` y `migrator` con `synchronize` desactivado, el helper de transacciones con `SELECT … FOR UPDATE` y el transformer `string ⇄ bigint`; verificación al arrancar de que la conexión de ejecución no es el dueño del schema (PLT-15, PLT-08)
- [x] 2.3 [api] Migración de auditoría: función `forbid_mutation()`, tabla `audit_log` sin FKs con `ck_audit_log_actor_type` y `ck_audit_log_action` (catálogo cerrado), triggers `tg_audit_log_no_update_delete` y `tg_audit_log_no_truncate`, y `GRANT INSERT` a `wallet_app` (AUD-01, AUD-04, AUD-05, AUD-06)
- [ ] 2.4 [api] Pruebas de inmutabilidad de la auditoría: como `wallet_app`, `SELECT`, `UPDATE`, `DELETE` y `TRUNCATE` fallan con `42501`; como dueño, `UPDATE`, `DELETE` y `TRUNCATE` fallan por los triggers (AUD-04, AUD-05)
- [ ] 2.5 [api] Migración de `users` con `uq_users_email`, `ck_users_email_normalized`, `uq_users_curp`, `uq_users_rfc`, `uq_users_phone`, `ck_users_full_name_length` y sus GRANTs (IDN-02, IDN-03)
- [ ] 2.6 [api] Migración de cuentas: función `clabe_is_valid()`, secuencia `seq_account_number`, tabla `accounts` con `ck_accounts_type`, `ck_accounts_owner_by_type`, `ck_accounts_clabe_by_type`, `ck_accounts_clabe_valid`, `ck_accounts_balance_non_negative`, `uq_accounts_clabe`, `uq_accounts_user_name`, `uq_accounts_single_system`, la cuenta "Tesorería" y los GRANTs (ACC-01, ACC-02, ACC-03, ACC-05)
- [ ] 2.7 [api] Pruebas de las garantías de cuentas en la base: Tesorería única y sin dueño, cuenta USER sin dueño rechazada, saldo negativo rechazado solo en USER, CLABE nula solo en SYSTEM y `clabe_is_valid` con los vectores compartidos (válido conocido, verificador incorrecto, suma múltiplo de 10, cero inicial) (ACC-01, ACC-02, ACC-03, ACC-05)
- [ ] 2.8 [api] Migraciones de `refresh_tokens` (`uq_refresh_tokens_token_hash`, `ix_refresh_tokens_family`, `fk_refresh_tokens_replaced_by`) y `one_time_codes` (`ck_one_time_codes_purpose`, `ck_one_time_codes_attempts`, `ck_one_time_codes_resend_count`, `uq_one_time_codes_purpose_subject`) con sus GRANTs (IDN-05, IDN-11)
- [ ] 2.9 [api] Pruebas de esquema: todos los nombres de constraints e índices con prefijo permitido, ningún `DELETE` ni `TRUNCATE` otorgado a `wallet_app`, `wallet_app` no puede crear tablas, migraciones ida-vuelta-ida y migrar dos veces sin cambios (PLT-04, PLT-14, PLT-15)

## 3. Plataforma HTTP

- [ ] 3.1 [api] Crear la app Express con el contexto de petición (`AsyncLocalStorage`) y el middleware de `X-Request-Id` (acepta `^[A-Za-z0-9_-]{1,64}$`, si no genera uno, y lo devuelve siempre); pruebas de reutilización y de identificador inválido (PLT-05)
- [ ] 3.2 [api] Configurar el logger JSON con `redact` de secretos, serializadores de enmascarado (email, teléfono, CURP, RFC, CLABE) y de `bigint`, y la línea por petición con método, ruta, status, duración, `requestId` y usuario; pruebas que capturan los logs y buscan valores en claro (PLT-06)
- [ ] 3.3 [api] Implementar los errores RFC 9457: error de dominio con `code`, middleware final, manejador 404 y 500 sin detalles internos; pruebas de formato, de ruta inexistente y de excepción inesperada (PLT-01, PLT-03)
- [ ] 3.4 [api] Implementar el middleware de validación con Zod en modo estricto: `400 MALFORMED_REQUEST` para JSON inválido y `422 VALIDATION_FAILED` con `errors[]` y JSON Pointers; pruebas de campo inválido y de campo no declarado (PLT-02)
- [ ] 3.5 [api] Implementar el traductor de errores de PostgreSQL por nombre de constraint (registro extensible para `api-ledger`; `40P01`, `40001` y `42501` a 500 con log de error); pruebas unitarias (PLT-04)
- [ ] 3.6 [api] Configurar `trust proxy` desde `TRUSTED_PROXIES`; pruebas de `X-Forwarded-For` ignorado desde un cliente directo y respetado desde un proxy de confianza (PLT-07)
- [ ] 3.7 [api] Implementar la infraestructura de rate limiting en memoria con respuesta `429 RATE_LIMITED` y `Retry-After`; pruebas de límite superado y de reinicio de la ventana con reloj controlado (PLT-09)
- [ ] 3.8 [api] Implementar `GET /health` sin autenticación; prueba (PLT-10)
- [ ] 3.9 [api] Servir `/docs` y `/openapi.yaml` desde el paquete del contrato solo fuera de producción; pruebas en desarrollo y en producción (PLT-11)
- [ ] 3.10 [api] Crear el helper `expectToMatchContract(res, operationId)` con Ajv 2020-12 y `ajv-formats` sobre el `openapi.yaml` del paquete, y usarlo en las pruebas HTTP existentes (PLT-12)
- [ ] 3.11 [api] Crear el puerto `Clock` con implementación de sistema y una falsa para pruebas (IDN-11, IDN-12)
- [ ] 3.12 [api] Crear el arnés de integración: aplica migraciones en `wallet_test` con la conexión `migrator`, entrega la conexión `app` al código y reinicia los datos entre pruebas (desactivando solo los triggers de protección dentro de la transacción de reinicio) (PLT-13)

## 4. Auditoría

- [ ] 4.1 [api] Implementar el escritor de auditoría transaccional: recibe la transacción en curso, toma `requestId`, IP y user agent del contexto, valida la acción contra el catálogo e inserta sin `RETURNING`; escritura independiente para eventos sin cambio de negocio (AUD-01, AUD-03, AUD-06)
- [ ] 4.2 [api] Pruebas de auditoría: una falla forzada al escribir el evento revierte la operación, ningún evento contiene datos personales y un login con email inexistente queda como `LOGIN_FAILED` anónimo (AUD-02, AUD-03, AUD-06)

## 5. Correo

- [ ] 5.1 [api] Implementar el puerto `Mailer` con el adaptador SMTP y las plantillas en español (código de verificación, aviso de intento de registro, registro no completado) y el envío después del COMMIT que registra las fallas con el destinatario enmascarado (PLT-16)
- [ ] 5.2 [api] Pruebas de correo: `Mailer` en memoria para casos de uso, adaptador SMTP contra Mailpit consultando su API y registro exitoso con el servidor SMTP caído (PLT-16)

## 6. Validaciones de dominio

- [ ] 6.1 [api] Implementar los validadores de dominio de CURP (estructura y dígito verificador), RFC de persona física (estructura y fecha real), teléfono a E.164 y normalización de email, y sus schemas Zod; pruebas unitarias con vectores (IDN-02)
- [ ] 6.2 [api] Implementar el cálculo del dígito verificador y la generación de CLABE (banco y plaza de la configuración, secuencia, verificador); pruebas unitarias con los mismos vectores que `clabe_is_valid` (ACC-03, ACC-05)

## 7. Identidad

- [ ] 7.1 [api] Implementar el hashing argon2id y el hash ficticio calculado al arrancar; prueba de que la contraseña no queda en claro en la base (IDN-04)
- [ ] 7.2 [api] Implementar los códigos de un solo uso: emisión de 6 dígitos con HMAC-SHA256, comparación en tiempo constante, intentos persistidos en una transacción propia, vencimiento y reenvíos que reemplazan el código; pruebas de vencimiento, de código invalidado por reenvío y de hash en la base (IDN-05)
- [ ] 7.3 [api] Implementar `registerUser` con respuesta 202 uniforme y las ramas email nuevo, email verificado, email sin verificar y choque de CURP, RFC o teléfono, con el evento `USER_REGISTERED`; pruebas de cada rama, de datos inválidos y de dos registros simultáneos con el mismo RFC (IDN-01, IDN-02, IDN-03)
- [ ] 7.4 [api] Implementar la apertura de "Principal" y "Ahorro" con CLABE generada como paso transaccional reutilizable (ACC-04)
- [ ] 7.5 [api] Implementar `verifyEmail` en una sola transacción (verificar, consumir el código, abrir cuentas, crear la familia de refresh, evento `EMAIL_VERIFIED`) que responde igual ante email desconocido o código incorrecto; pruebas de éxito, tercer intento, email desconocido, verificación repetida y usuario sin verificar sin cuentas (IDN-06, ACC-04, AUD-03)
- [ ] 7.6 [api] Implementar `resendVerificationEmail` con 202 uniforme y el evento `EMAIL_VERIFICATION_RESENT`; pruebas de reenvío válido y de cuarto reenvío sin envío (IDN-07)
- [ ] 7.7 [api] Implementar la emisión y verificación del access token (HS256, 10 min, `iss`, `aud`, `jti`) y el middleware de autenticación por defecto con su lista de rutas públicas; pruebas de `alg: none`, vencido con reloj controlado, audiencia incorrecta y ruta protegida sin token (IDN-09, IDN-10)
- [ ] 7.8 [api] Implementar `refreshSession`: familia, rotación con la fila bloqueada, vencimiento de 7 y 30 días, detección de reuso con revocación de la familia y evento `REFRESH_TOKEN_REUSE_DETECTED`, y ventana de gracia de 30 s; pruebas de rotación, familia vencida, reintento dentro de la ventana, reuso fuera de ella, reuso con sucesor usado y dos refresh simultáneos (IDN-11, IDN-12)
- [ ] 7.9 [api] Implementar `login` con `401 INVALID_CREDENTIALS` uniforme, verificación del hash ficticio cuando el email no existe, `403 EMAIL_NOT_VERIFIED` y los eventos `LOGIN_SUCCEEDED` y `LOGIN_FAILED`; pruebas de cada caso (IDN-08)
- [ ] 7.10 [api] Implementar `logout` idempotente con el evento `LOGOUT`; pruebas de refresh tras logout y de logout repetido (IDN-13)
- [ ] 7.11 [api] Implementar `getCurrentUser` con CURP, RFC y teléfono enmascarados; prueba (IDN-14)
- [ ] 7.12 [api] Aplicar los límites de tasa de identidad (login por IP + email y por IP; registro, verificación y reenvío por IP); pruebas del sexto intento y de login exitoso desde otra IP (IDN-15)
- [ ] 7.13 [api] Implementar el acceso a cuentas filtrado por dueño en el repositorio, con resultado idéntico para cuenta ajena e inexistente; prueba a nivel de repositorio (la prueba del endpoint llega con `getAccount` en `api-ledger`) (ACC-06)

## 8. Seed y documentación

- [ ] 8.1 [api] Implementar `db:seed` con la conexión `migrator` que crea los usuarios demo verificados (Ana y Luis) con sus dos cuentas, de forma idempotente (PLT-13)
- [ ] 8.2 [api] Escribir el README de `/api`: requisitos, `.env`, comandos en orden, credenciales demo, bandeja de Mailpit, `/docs`, cómo correr pruebas y estructura por capas (PLT-13, PLT-18)

## 9. Integración continua

- [ ] 9.1 [api] Crear `.github/workflows/api.yml` disparado por `api/**`, `contract/**` y el propio workflow, con services de PostgreSQL 16 y Mailpit, build de `/contract`, `npm ci`, lint, typecheck, `db:bootstrap` con `psql`, migraciones ida-vuelta-ida y `npm test` (PLT-17, PLT-15)
- [ ] 9.2 [api] Confirmar el pipeline en verde en la rama principal y que un cambio solo en `contract/**` lo dispara (PLT-17)
