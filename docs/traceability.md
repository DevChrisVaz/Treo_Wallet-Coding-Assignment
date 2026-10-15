# Matriz de trazabilidad

Generada con `scripts/trace.sh`: 235 requisitos. Las columnas de tareas y commits muestran el total y los primeros; los commits son los que citan el ID en `Refs:` o los que ligan una tarea que lo nombra con `Task:`. En `Pruebas` se cuentan las pruebas cuyo título empieza con el ID, por proyecto.

| ID | Requisito | Change | Tareas | Commits | Pruebas |
|---|---|---|---|---|---|
| ACC-01 | Cuentas de usuario y cuenta de sistema | api-foundation | 3: api-foundation#2.6 api-foundation#2.7 domain-test-coverage#6.1 | 4: 071c478 2019ab8 db6dda4 (+1) | api 8 |
| ACC-02 | Saldo no negativo garantizado por la base | api-foundation | 2: api-foundation#2.6 api-foundation#2.7 | 2: db6dda4 6f75136 | api 3 |
| ACC-03 | CLABE de las cuentas de usuario | api-foundation | 4: api-foundation#2.6 api-foundation#2.7 api-foundation#6.2 (+1) | 5: 071c478 2bdbcc7 0f7bc0a (+2) | api 8 |
| ACC-04 | Apertura de cuentas al verificar el correo | api-foundation | 2: api-foundation#7.4 api-foundation#7.5 | 2: 59b0f0e ee29078 | api 7 |
| ACC-05 | Dígito verificador de la CLABE validado en la base | api-foundation | 4: api-foundation#2.6 api-foundation#2.7 api-foundation#6.2 (+1) | 4: befd9dd 0f7bc0a db6dda4 (+1) | api 6 |
| ACC-06 | Propiedad de las cuentas | api-foundation | 2: api-foundation#7.13 domain-test-coverage#6.1 | 2: 071c478 7285ef5 | api 7 |
| ACC-10 | Consulta de cuentas con saldo disponible | api-ledger | 3: api-ledger#4.1 api-ledger#4.4 api-ledger#12.1 | 3: a5e5381 0a5db33 440e5d0 | api 8 |
| ACC-11 | Estado del límite diario en el resumen de cuentas | api-ledger | 4: api-ledger#1.3 api-ledger#4.2 api-ledger#4.4 (+1) | 4: ceff508 0a5db33 ec1b890 (+1) | api 8 |
| ACC-12 | Detalle de una cuenta propia | api-ledger | 2: api-ledger#4.3 api-ledger#4.4 | 2: 0a5db33 ad14fbf | api 4 |
| ACC-13 | Saldo disponible igual al saldo contable | api-ledger | 3: api-ledger#4.1 api-ledger#4.4 api-ledger#7.5 | 3: 2051b07 0a5db33 440e5d0 | api 3 |
| ACC-14 | Conciliación entre saldos y asientos | api-ledger | 4: api-ledger#3.4 api-ledger#10.1 api-ledger#11.3 (+1) | 6: 2019ab8 8f0eada fc5307d (+3) | api 3 |
| ACC-15 | Fondeo desde la Tesorería | api-ledger | 5: api-ledger#3.2 api-ledger#3.3 api-ledger#3.5 (+2) | 5: 8f0eada 56a27d7 a421efd (+2) | api 11 |
| ACC-16 | La Tesorería no participa en operaciones de usuario | api-ledger | 3: api-ledger#4.3 api-ledger#6.2 api-ledger#6.10 | 3: 6ef5fea 89ddb7f ad14fbf | api 3 |
| AUD-01 | Catálogo de eventos auditados | api-foundation, registration-review | 6: api-foundation#2.3 api-foundation#4.1 domain-test-coverage#3.2 (+3) | 10: e667fa6 7266ea7 6a86b5f (+7) | api 22 |
| AUD-02 | Sin datos personales en la auditoría | api-foundation | 2: api-foundation#4.2 domain-test-coverage#4.4 | 2: 61d5af0 7412958 | api 4 |
| AUD-03 | Escritura atómica con la operación | api-foundation | 3: api-foundation#4.1 api-foundation#4.2 api-foundation#7.5 | 3: 59b0f0e 7412958 b566a41 | api 6 |
| AUD-04 | Inmutabilidad garantizada por permisos | api-foundation | 3: api-foundation#2.3 api-foundation#2.4 domain-test-coverage#6.4 | 3: 20a2ea5 8dcd57a aaffc66 | api 5 |
| AUD-05 | Inmutabilidad de respaldo ante el dueño del esquema | api-foundation | 2: api-foundation#2.3 api-foundation#2.4 | 2: 8dcd57a aaffc66 | api 4 |
| AUD-06 | Eventos independientes de otras tablas | api-foundation | 3: api-foundation#2.3 api-foundation#4.1 api-foundation#4.2 | 3: 7412958 b566a41 aaffc66 | api 5 |
| AUD-07 | Estado de cuenta exportado | account-statements | 2: account-statements#1.7 account-statements#1.8 | 5: f885c2c 53579be 0da720a (+2) | api 8 |
| AUD-08 | Eventos de las transferencias programadas | scheduled-transfers | 4: domain-test-coverage#2.5 scheduled-transfers#2.2 scheduled-transfers#2.7 (+1) | 5: e3e44a5 cbd374e 5726805 (+2) | api 7 |
| BEN-01 | Registro de un beneficiario | api-ledger | 5: api-ledger#5.3 api-ledger#5.4 api-ledger#5.6 (+2) | 5: a5e5381 56a27d7 c076f67 (+2) | api 7 |
| BEN-02 | Formato de los datos del beneficiario | api-ledger | 2: api-ledger#5.1 api-ledger#5.6 | 2: c076f67 ce2c6e3 | api 7 |
| BEN-03 | Dígito verificador de la CLABE | api-ledger | 3: api-ledger#5.2 api-ledger#5.5 api-ledger#5.6 | 3: c076f67 eba3a5c 9f2ebd0 | api 3 |
| BEN-04 | La CLABE debe pertenecer a la plataforma | api-ledger | 2: api-ledger#5.2 api-ledger#5.6 | 2: c076f67 9f2ebd0 | api 2 |
| BEN-05 | Una cuenta propia no puede ser beneficiario | api-ledger | 2: api-ledger#5.2 api-ledger#5.6 | 2: c076f67 9f2ebd0 | api 1 |
| BEN-06 | Orden de las validaciones | api-ledger | 2: api-ledger#5.2 api-ledger#5.5 | 2: eba3a5c 9f2ebd0 | api 5 |
| BEN-07 | Idempotencia por contenido y conflictos | api-ledger | 5: api-ledger#2.9 api-ledger#5.3 api-ledger#5.6 (+2) | 7: bfc57a6 0564f3a c08db61 (+4) | api 10 |
| BEN-08 | Integridad de beneficiarios en la base de datos | api-ledger | 4: api-ledger#2.1 api-ledger#2.7 api-ledger#5.6 (+1) | 4: 0564f3a c076f67 53b198e (+1) | api 11 |
| BEN-09 | Listado de beneficiarios | api-ledger | 2: api-ledger#5.4 api-ledger#5.6 | 2: c076f67 605ed26 | api 3 |
| BEN-10 | Límite de altas de beneficiarios | api-ledger | 2: api-ledger#5.4 api-ledger#5.6 | 2: c076f67 605ed26 | api 1 |
| BEN-11 | Auditoría del alta de beneficiarios | api-ledger | 3: api-ledger#5.3 api-ledger#5.6 domain-test-coverage#4.2 | 3: b347718 c076f67 e3e5f28 | api 4 |
| BEN-12 | Aviso del alta de un beneficiario | security-hardening | 1: security-hardening#3.5 | 8: 755b17c d8accf3 b2eb142 (+5) | api 7 |
| CTR-01 | Contrato OpenAPI como fuente de verdad | contract-v1 | 2: contract-v1#1.2 contract-v1#6.1 | 2: b2f920a 25ea459 | contract 3 |
| CTR-02 | Versionado semántico del contrato | contract-v1 | 7: contract-v1#1.3 contract-v1#6.2 contract-v1-1#1.3 (+4) | 13: dc7670d 3df47c3 b211155 (+10) | contract 3 |
| CTR-03 | Tipos generados desde el contrato | contract-v1 | 3: contract-v1#2.1 contract-v1#2.2 contract-v1#6.1 | 3: b2f920a cdb92c8 cd24bec | contract 3 |
| CTR-04 | Cliente HTTP tipado por rutas | contract-v1 | 1: contract-v1#2.3 | 1: 8e1a0da | contract 8 |
| CTR-05 | Request ID en cada petición | contract-v1 | 1: contract-v1#2.4 | 1: 24b5d02 | contract 3 |
| CTR-06 | Llave de idempotencia provista por el consumidor | contract-v1 | 1: contract-v1#2.5 | 1: eb75c81 | contract 5 |
| CTR-07 | Errores problem+json como error tipado | contract-v1, contract-v1-1 | 7: contract-v1#2.2 contract-v1#2.6 contract-v1-1#1.2 (+4) | 8: 2f4ff67 dd44998 2712c63 (+5) | contract 14 |
| CTR-08 | Validación de montos sin floats ni redondeo | contract-v1 | 2: contract-v1#3.1 contract-v1#3.2 | 2: d0ba89c b48223f | contract 2 |
| CTR-09 | Validación de CLABE con dígito verificador | contract-v1 | 3: contract-v1#3.1 contract-v1#3.3 domain-test-coverage#7.4 | 3: befd9dd 6bd1b79 b48223f | contract 3, api 1 |
| CTR-10 | Validación de CURP con dígito verificador | contract-v1 | 4: contract-v1#3.1 contract-v1#3.4 domain-test-coverage#7.1 (+1) | 4: befd9dd 39512bb 3c59b09 (+1) | api 1 |
| CTR-11 | Validación de RFC de persona física | contract-v1, ux-fixes | 5: contract-v1#3.1 contract-v1#3.5 domain-test-coverage#7.1 (+2) | 6: 8721244 b79fd1e befd9dd (+3) | contract 3 |
| CTR-12 | Validación de teléfono, concepto, referencia y códigos | contract-v1, ux-fixes | 6: contract-v1#3.1 contract-v1#3.6 domain-test-coverage#7.2 (+3) | 5: 8721244 b79fd1e 0dcce09 (+2) | contract 8 |
| CTR-13 | Esquemas de formularios alineados con el contrato | contract-v1, contract-v1-2, registration-birth-data, ux-fixes | 11: contract-v1#3.7 contract-v1#3.8 contract-v1-2#1.2 (+8) | 16: a23c4d6 3220257 1972769 (+13) | contract 24 |
| CTR-14 | Formato de montos en es-MX sin floats | contract-v1 | 2: contract-v1#4.1 contract-v1#4.2 | 2: 3f8a98b 00bafd9 | contract 2 |
| CTR-15 | Paquete agnóstico de entorno | contract-v1, contract-v1-1 | 5: contract-v1#1.1 contract-v1#5.1 contract-v1#5.2 (+2) | 7: 6f0a8a7 18354b0 f486d8d (+4) | contract 6 |
| CTR-16 | Distribución como artefacto, sin dependencias de código | contract-v1 | 3: contract-v1#5.1 contract-v1#5.3 contract-v1#6.2 | 4: f909af3 b859bf3 75f61c2 (+1) | contract 1 |
| CTR-17 | Verificación continua del paquete | contract-v1 | 1: contract-v1#6.1 | 1: b2f920a | contract 2 |
| CTR-18 | Calendario de la Ciudad de México en el paquete | contract-v1-2, ux-fixes | 2: contract-v1-2#1.3 ux-fixes#10.1 | 6: 3220257 1972769 8721244 (+3) | contract 3 |
| CTR-19 | Descarga de documentos binarios | contract-v1-2 | 1: contract-v1-2#1.1 | 2: f415c27 ad628da | contract 3 |
| CTR-20 | Utilidades de captura y búsqueda de texto | ux-fixes | 3: ux-fixes#3.1 ux-fixes#5.1 ux-fixes#8.1 | 2: 8721244 b79fd1e | contract 10 |
| CTR-21 | Catálogo de entidades de nacimiento | registration-birth-data | 1: registration-birth-data#1.2 | 3: cef2c5a a3d4229 dc7670d | contract 2 |
| CTR-22 | Respuesta 429 en el cierre de sesión | security-hardening | 1: security-hardening#1.1 | 6: 755b17c d8accf3 b2eb142 (+3) | contract 2 |
| DSG-01 | Paquete de tokens como fuente única | design-system | 8: design-system#1.1 design-system#5.1 design-system#5.2 (+5) | 11: b1ea000 f251908 e174ed1 (+8) | web 2, mobile 4, design-tokens 7 |
| DSG-02 | Identidad visual basada en Treo | design-system | 2: design-system#2.1 web-app#1.3 | 4: 9e12634 715b4b1 7b6e740 (+1) | web 2, mobile 2, design-tokens 3 |
| DSG-03 | Tokens semánticos | design-system | 3: design-system#2.1 web-app#1.5 mobile-app#1.7 | 8: f3f3e97 c3af92d 21b249b (+5) | mobile 2, design-tokens 2 |
| DSG-04 | Contraste accesible verificado | design-system | 1: design-system#2.2 | 2: f9d0256 ff80797 | design-tokens 3 |
| DSG-05 | Tipografía | design-system | 3: design-system#2.3 web-app#1.3 mobile-app#1.6 | 6: e845649 d08344c e174ed1 (+3) | web 2, mobile 5, design-tokens 6 |
| DSG-06 | Espaciado, forma, foco y movimiento | design-system | 4: design-system#2.3 web-app#1.3 web-app#1.5 (+1) | 10: f3f3e97 c3af92d 21b249b (+7) | web 4, mobile 4, design-tokens 7 |
| DSG-07 | Tema claro listo para tema oscuro | design-system | 3: design-system#2.1 design-system#4.1 design-system#5.3 | 3: 6388596 a316ca5 26d7248 | design-tokens 3 |
| DSG-08 | Salidas por plataforma desde una sola fuente | design-system | 4: design-system#4.1 design-system#4.2 design-system#5.1 (+1) | 4: 9cd4a31 1ea486f 2562373 (+1) | design-tokens 5 |
| DSG-09 | Convenciones de dinero | design-system | 7: design-system#3.1 web-app#1.5 web-app#6.1 (+4) | 12: f3f3e97 c3af92d 21b249b (+9) | web 4, mobile 5, design-tokens 4 |
| DSG-10 | Estados de transferencia y tipos de movimiento | design-system | 7: design-system#3.1 web-app#1.5 web-app#6.2 (+4) | 12: f3f3e97 c3af92d 21b249b (+9) | web 2, mobile 5 |
| DSG-11 | Inventario de componentes | design-system | 9: design-system#4.3 design-system#5.3 web-app#1.5 (+6) | 16: e79868c f3f3e97 c3af92d (+13) | web 16, mobile 15, design-tokens 2 |
| DSG-12 | Textos de la interfaz | design-system, registration-review | 4: design-system#3.2 web-app#5.1 mobile-app#2.6 (+1) | 8: e667fa6 516d96c 0f64221 (+5) | web 4, design-tokens 4 |
| DSG-13 | Lenguaje visual elevado de la marca | redesign | 6: redesign#2.1 redesign#3.2 redesign#4.2 (+3) | 24: 482b0aa 4d9569e d301828 (+21) | web 3, mobile 3, design-tokens 2 |
| DSG-14 | Lima solo sobre superficies oscuras | redesign | 1: redesign#2.2 | 2: f52d371 f9d0256 | web 3, design-tokens 3 |
| DSG-15 | Iconografía compartida | redesign | 4: redesign#2.3 redesign#3.1 redesign#4.1 (+1) | 22: 5522250 64d86f3 e0be490 (+19) | web 4, mobile 5, design-tokens 5 |
| DSG-16 | Tokens v2 aditivos para las tres salidas | redesign | 3: redesign#2.1 redesign#5.4 redesign#P0 | 11: 4d9569e 3a247e4 1b48b7d (+8) | design-tokens 5 |
| DSG-17 | Inventario de componentes v2 | redesign | 10: redesign#1.1 redesign#1.2 redesign#1.3 (+7) | 56: e845649 c4f1976 8f9555e (+53) | web 21, mobile 5, design-tokens 6 |
| DSG-18 | Estados y textos de las transferencias programadas | scheduled-transfers | 1: scheduled-transfers#1.1 | 4: 476fabd 85a9feb c916ab5 (+1) | design-tokens 3 |
| HIS-01 | Historial por cuenta propia | api-ledger | 3: api-ledger#9.3 api-ledger#9.4 api-ledger#9.5 | 3: 36d5ccf 304d730 d9386c6 | api 7 |
| HIS-02 | Solo el dinero que se movió | api-ledger | 2: api-ledger#9.3 api-ledger#9.5 | 2: 36d5ccf d9386c6 | api 1 |
| HIS-03 | Contenido de un movimiento | api-ledger, ux-fixes | 5: account-statements#1.4 api-ledger#9.3 api-ledger#9.5 (+2) | 5: 7663863 6d3cadb a5e5381 (+2) | api 10 |
| HIS-04 | Orden y paginación por cursor | api-ledger | 3: api-ledger#9.1 api-ledger#9.3 api-ledger#9.5 | 3: 36d5ccf d9386c6 8cffde8 | api 11 |
| HIS-05 | Cursor ligado a los filtros | api-ledger | 3: api-ledger#1.6 api-ledger#9.2 domain-test-coverage#5.3 | 4: b82d5f3 ed14599 4779a20 (+1) | api 11 |
| HIS-06 | Filtro por fechas en la zona horaria de la Ciudad de México | api-ledger | 5: api-ledger#1.3 api-ledger#9.1 api-ledger#9.3 (+2) | 5: b82d5f3 36d5ccf d9386c6 (+2) | api 11 |
| HIS-07 | Filtro por tipo de movimiento | api-ledger | 3: api-ledger#9.1 api-ledger#9.3 api-ledger#9.5 | 3: 36d5ccf d9386c6 8cffde8 | api 5 |
| HIS-08 | Últimos movimientos | api-ledger | 3: api-ledger#9.4 api-ledger#9.5 domain-test-coverage#5.1 | 5: bfc57a6 a348540 246e8e1 (+2) | api 5 |
| HIS-09 | Rendimiento del historial con volumen | api-ledger | 4: api-ledger#2.3 api-ledger#11.4 api-ledger#11.5 (+1) | 5: b37b072 ed14599 4aa488a (+2) | api 1 |
| HIS-10 | Datos de volumen para desarrollo | api-ledger | 4: api-ledger#11.1 api-ledger#11.2 api-ledger#11.3 (+1) | 6: ed14599 8f0eada fc5307d (+3) | api 17 |
| HIS-11 | Estado de cuenta mensual en PDF | account-statements, ux-fixes | 6: account-statements#1.1 account-statements#1.2 account-statements#1.8 (+3) | 12: 7663863 b79fd1e 0b9c0c9 (+9) | contract 9, api 29 |
| HIS-12 | Contenido y conciliación del estado de cuenta | account-statements, ux-fixes | 10: account-statements#1.2 account-statements#1.3 account-statements#1.4 (+7) | 13: 7663863 bfc57a6 0b9c0c9 (+10) | api 46 |
| IDN-01 | Registro con respuesta uniforme | api-foundation | 5: api-foundation#7.3 domain-test-coverage#3.1 domain-test-coverage#3.5 (+2) | 12: 46d46aa a17006e fd33dde (+9) | api 7 |
| IDN-02 | Datos obligatorios del registro | api-foundation, registration-birth-data, ux-fixes | 10: api-foundation#2.5 api-foundation#6.1 api-foundation#7.3 (+7) | 13: 3220257 1972769 cef2c5a (+10) | api 35 |
| IDN-03 | Unicidad de los datos de identidad | api-foundation, registration-review | 9: api-foundation#2.5 api-foundation#7.3 domain-test-coverage#3.5 (+6) | 22: d4a26ac e667fa6 4de4677 (+19) | api 15 |
| IDN-04 | Almacenamiento seguro de contraseñas | api-foundation | 1: api-foundation#7.1 | 1: fed4b5e | api 5 |
| IDN-05 | Código de verificación de correo | api-foundation | 4: api-foundation#2.8 api-foundation#7.2 domain-test-coverage#3.1 (+1) | 4: c51d653 a5fe8fb 6323e25 (+1) | api 15 |
| IDN-06 | Verificación de correo | api-foundation, registration-review | 5: api-foundation#7.5 domain-test-coverage#3.6 registration-review#1.1 (+2) | 11: d4a26ac e667fa6 4de4677 (+8) | api 10 |
| IDN-07 | Reenvío del código de verificación | api-foundation | 2: api-foundation#7.6 domain-test-coverage#3.5 | 2: 6d835e1 0c7d57c | api 5 |
| IDN-08 | Inicio de sesión sin enumeración | api-foundation, registration-review | 4: api-foundation#7.9 domain-test-coverage#3.6 registration-review#1.1 (+1) | 8: e667fa6 4de4677 c62b858 (+5) | api 10 |
| IDN-09 | Access token de vida corta | api-foundation | 1: api-foundation#7.7 | 1: 557d660 | api 5 |
| IDN-10 | Rutas protegidas por defecto | api-foundation | 2: api-foundation#7.7 domain-test-coverage#3.4 | 3: f7bee34 2bdbcc7 557d660 | api 8 |
| IDN-11 | Refresh token opaco con rotación | api-foundation | 3: api-foundation#2.8 api-foundation#3.11 api-foundation#7.8 | 3: cbe5bd4 a8c3f69 d878630 | api 14 |
| IDN-12 | Detección de reuso con ventana de gracia | api-foundation | 4: api-foundation#3.11 api-foundation#7.8 domain-test-coverage#3.2 (+1) | 6: bfc57a6 0e16298 53fa0a4 (+3) | api 11 |
| IDN-13 | Cierre de sesión | api-foundation | 2: api-foundation#7.10 domain-test-coverage#3.4 | 2: f7bee34 3b4e4d9 | api 6 |
| IDN-14 | Datos del usuario autenticado | api-foundation | 1: api-foundation#7.11 | 1: 2d0c704 | api 2 |
| IDN-15 | Límites de tasa en identidad | api-foundation | 1: api-foundation#7.12 | 1: 0e1fa0a | api 5 |
| IDN-16 | Aviso al dueño de los datos de identidad | registration-review | 1: registration-review#3.3 | 6: d4a26ac e667fa6 4de4677 (+3) | api 5 |
| IDN-17 | Límites de tasa de renovación y cierre de sesión | security-hardening | 2: security-hardening#1.1 security-hardening#2.2 | 8: 755b17c d8accf3 b2eb142 (+5) | api 7 |
| IDN-18 | Aviso de inicio de sesión | security-hardening | 2: security-hardening#3.1 security-hardening#3.2 | 8: 755b17c d8accf3 b2eb142 (+5) | api 16 |
| IDN-19 | Aviso de sesión cerrada por seguridad | security-hardening | 1: security-hardening#3.4 | 8: 755b17c d8accf3 b2eb142 (+5) | api 7 |
| MOB-01 | Inicio de sesión | mobile-app | 5: contract-v1-1#3.1 redesign#7.2 mobile-app#3.1 (+2) | 4: 54aea3e dd44998 4cac987 (+1) | mobile 7 |
| MOB-02 | Almacenamiento seguro de tokens | mobile-app | 5: biometric-unlock#2.1 mobile-app#1.3 mobile-app#1.5 (+2) | 6: 946a9af 4cac987 285efd1 (+3) | mobile 15 |
| MOB-03 | Renovación de la sesión de una sola vez | mobile-app | 3: mobile-app#2.2 mobile-app#2.3 mobile-app#2.4 | 4: 4cac987 285efd1 a6c0e55 (+1) | mobile 10 |
| MOB-04 | Cierre de sesión | mobile-app | 2: biometric-unlock#2.4 mobile-app#2.5 | 5: 6be6deb e4e7ace bca19cc (+2) | mobile 5 |
| MOB-05 | Saldo de las cuentas | mobile-app | 2: mobile-app#3.2 mobile-app#] | 3: d623796 4cac987 d3773c6 | mobile 7 |
| MOB-06 | Últimos 20 movimientos | mobile-app, ux-fixes | 3: mobile-app#3.3 mobile-app#] ux-fixes#4.4 | 6: 5522250 85a4322 252c5fe (+3) | mobile 8 |
| MOB-07 | Selección de beneficiario registrado | mobile-app | 2: redesign#7.5 mobile-app#4.5 | 5: c11c20f 123421b 225c723 (+2) | mobile 5 |
| MOB-08 | Captura y validación de la transferencia | mobile-app, ux-fixes | 3: mobile-app#4.6 ux-fixes#3.4 ux-fixes#4.4 | 6: 5522250 225c723 a1bb69a (+3) | mobile 13 |
| MOB-09 | Confirmación previa y envío único | mobile-app | 2: mobile-app#4.1 mobile-app#4.7 | 5: 225c723 b64bd2f 4cac987 (+2) | mobile 14 |
| MOB-10 | Reintento ante pérdida de red con la misma llave | mobile-app | 7: mobile-app#1.3 mobile-app#2.2 mobile-app#4.2 (+4) | 8: 225c723 4cac987 99de8f7 (+5) | mobile 21 |
| MOB-11 | Estado incierto y reintento manual | mobile-app | 2: mobile-app#4.4 mobile-app#4.8 | 4: 225c723 4cac987 c4fc58e (+1) | mobile 5 |
| MOB-12 | Confirmación con OTP | mobile-app, ux-fixes | 3: mobile-app#4.9 mobile-app#] ux-fixes#5.4 | 5: 5522250 123421b 225c723 (+2) | mobile 22 |
| MOB-13 | Resultado con el estado real | mobile-app, ux-fixes | 3: mobile-app#4.10 mobile-app#4.11 ux-fixes#4.4 | 9: 5522250 fc6bb8b 123421b (+6) | mobile 9 |
| MOB-14 | Mensajes de error por código | mobile-app | 4: redesign#7.5 mobile-app#2.6 mobile-app#4.8 (+1) | 7: c11c20f 123421b 225c723 (+4) | mobile 9 |
| MOB-15 | Montos sin punto flotante | mobile-app | 4: mobile-app#1.2 mobile-app#3.2 mobile-app#3.3 (+1) | 6: d623796 4cac987 d698a85 (+3) | mobile 8 |
| MOB-16 | Privacidad en segundo plano | mobile-app | 4: biometric-unlock#2.3 mobile-app#1.3 mobile-app#5.1 (+1) | 6: 4f247e2 5a0cbb3 4cac987 (+3) | mobile 12 |
| MOB-17 | URL de la API configurable para desarrollo local | mobile-app | 4: mobile-app#1.1 mobile-app#1.4 mobile-app#6.1 (+1) | 5: 6265630 4cac987 4e5054c (+2) | mobile 13 |
| MOB-18 | Navegación por pestañas | redesign | 5: redesign#4.3 redesign#5.2 redesign#7.1 (+2) | 12: 482b0aa 4d9569e 07980de (+9) | mobile 17 |
| MOB-19 | Inicio rediseñado | redesign, ux-fixes | 4: redesign#4.4 redesign#5.2 redesign#7.3 (+1) | 10: 5522250 07980de d623796 (+7) | mobile 20 |
| MOB-20 | Movimientos como pestaña | redesign | 3: redesign#4.4 redesign#5.2 redesign#7.4 | 11: 07980de 85a4322 e4e7ace (+8) | mobile 16 |
| MOB-21 | Flujo de transferencia por pasos | redesign | 3: redesign#4.5 redesign#5.2 redesign#7.5 | 13: fc6bb8b 1e9565c 07980de (+10) | mobile 17 |
| MOB-22 | Inicio de sesión de marca | redesign | 2: redesign#5.2 redesign#7.2 | 6: 07980de 54aea3e a2e2231 (+3) | mobile 3 |
| MOB-23 | Estados de las programadas en la app | scheduled-transfers, ux-fixes | 3: redesign#P2 scheduled-transfers#4.1 ux-fixes#10.4 | 19: 5522250 b1ea000 048ca0b (+16) | mobile 3 |
| MOB-24 | Activación opcional del desbloqueo biométrico | biometric-unlock | 7: biometric-unlock#1.1 biometric-unlock#1.2 biometric-unlock#3.1 (+4) | 23: b1ea000 048ca0b fa94051 (+20) | mobile 33 |
| MOB-25 | Bloqueo al abrir y al volver de segundo plano | biometric-unlock | 6: biometric-unlock#2.1 biometric-unlock#2.2 biometric-unlock#2.3 (+3) | 22: b1ea000 048ca0b fa94051 (+19) | mobile 22 |
| MOB-26 | Alternativas al desbloqueo biométrico | biometric-unlock | 3: biometric-unlock#2.2 biometric-unlock#2.4 biometric-unlock#] | 5: fa94051 1e9565c bca19cc (+2) | mobile 10 |
| MOB-27 | Desactivación del desbloqueo | biometric-unlock | 4: biometric-unlock#1.2 biometric-unlock#2.4 biometric-unlock#3.2 (+1) | 8: fa94051 f251908 1e9565c (+5) | mobile 8 |
| MOB-28 | Recibir dinero | ux-fixes | 1: ux-fixes#7.2 | 2: 5522250 b79fd1e | mobile 4 |
| MOB-29 | Búsqueda de beneficiarios | ux-fixes | 1: ux-fixes#8.3 | 2: 5522250 b79fd1e | mobile 7 |
| MOB-30 | Registro en revisión al iniciar sesión | registration-review | 1: registration-review#5.1 | 4: e667fa6 4de4677 96e9f45 (+1) | mobile 1 |
| MOB-31 | Un 429 no cierra la sesión ni se trata como falla del servidor | security-hardening | 1: security-hardening#5.1 | 7: 755b17c d8accf3 b2eb142 (+4) | mobile 6 |
| MOB-32 | La app se identifica con su User-Agent | security-hardening | 1: security-hardening#5.2 | 8: 755b17c d8accf3 b2eb142 (+5) | mobile 6 |
| PLT-01 | Formato de errores RFC 9457 | api-foundation | 1: api-foundation#3.3 | 1: ce43309 | api 7 |
| PLT-02 | Validación de entrada contra el contrato | api-foundation | 1: api-foundation#3.4 | 1: 228b4a0 | api 8 |
| PLT-03 | Errores internos sin detalles | api-foundation | 1: api-foundation#3.3 | 1: ce43309 | api 2 |
| PLT-04 | Traducción de errores de integridad por nombre de constraint | api-foundation | 2: api-foundation#2.9 api-foundation#3.5 | 4: 2bdbcc7 3c1128f 87189e8 (+1) | api 12 |
| PLT-05 | Identificador de petición | api-foundation | 1: api-foundation#3.1 | 1: 6c601bf | api 7 |
| PLT-06 | Logs estructurados con datos sensibles enmascarados | api-foundation | 1: api-foundation#3.2 | 2: 2bdbcc7 699a6af | api 10 |
| PLT-07 | IP del cliente solo desde proxies de confianza | api-foundation | 1: api-foundation#3.6 | 1: cd88f77 | api 4 |
| PLT-08 | Configuración validada al arrancar | api-foundation | 2: api-foundation#1.3 api-foundation#2.2 | 3: 2bdbcc7 cec41a8 d9cec7a | api 13 |
| PLT-09 | Límites de tasa | api-foundation | 1: api-foundation#3.7 | 1: 322414a | api 4 |
| PLT-10 | Salud del servicio | api-foundation | 1: api-foundation#3.8 | 1: 0bf2009 | api 2 |
| PLT-11 | Documentación navegable del contrato | api-foundation | 1: api-foundation#3.9 | 1: 6857381 | api 5 |
| PLT-12 | Conformidad de las respuestas con el contrato | api-foundation | 1: api-foundation#3.10 | 1: e853997 | api 6 |
| PLT-13 | Entorno local reproducible | api-foundation, ux-fixes | 6: api-foundation#1.1 api-foundation#1.4 api-foundation#3.12 (+3) | 10: b211155 7663863 b79fd1e (+7) | api 13 |
| PLT-14 | Roles de base de datos de privilegio mínimo | api-foundation, tooling-fixes | 4: api-foundation#2.1 api-foundation#2.9 tooling-fixes#1.1 (+1) | 10: 755b17c 3abf76d 197606e (+7) | api 25 |
| PLT-15 | Esquema gestionado solo por migraciones reversibles | api-foundation | 3: api-foundation#2.2 api-foundation#2.9 api-foundation#9.1 | 4: a8230bd 3c1128f 2a0ebd5 (+1) | api 17 |
| PLT-16 | Entrega de correo transaccional | api-foundation, email-branding, security-hardening | 6: api-foundation#5.1 api-foundation#5.2 email-branding#1.1 (+3) | 18: 4ff1da7 2464a4f 8874181 (+15) | api 34 |
| PLT-17 | Integración continua del proyecto | api-foundation | 2: api-foundation#9.1 api-foundation#9.2 | 3: 2bdbcc7 baa7583 a8230bd | contract 1 |
| PLT-18 | Reglas de negocio independientes del transporte HTTP | api-foundation | 2: api-foundation#1.2 api-foundation#8.2 | 3: 8a6ce7b 1ee03e0 6abd830 | api 6 |
| PLT-19 | Límites de tasa configurables | security-hardening | 4: security-hardening#2.1 security-hardening#2.2 security-hardening#2.3 (+1) | 10: 755b17c d8accf3 b2eb142 (+7) | api 2 |
| PLT-20 | Respuestas sin caché | security-hardening | 1: security-hardening#2.5 | 8: 755b17c d8accf3 b2eb142 (+5) | api 6 |
| TRF-01 | Creación de una transferencia | api-ledger | 3: api-ledger#6.6 api-ledger#6.7 api-ledger#6.8 | 3: 945ad31 cd9d7bc 07e1a09 | api 8 |
| TRF-02 | Llave de idempotencia obligatoria | api-ledger | 4: api-ledger#2.2 api-ledger#6.1 api-ledger#6.8 (+1) | 4: 7b10a6a 945ad31 a295ab9 (+1) | api 10 |
| TRF-03 | Reintento con la misma llave devuelve el estado real | api-ledger | 6: api-ledger#6.3 api-ledger#6.9 api-ledger#12.1 (+3) | 9: bfc57a6 7b10a6a e140c54 (+6) | contract 5, api 18 |
| TRF-04 | Llave reutilizada con otro contenido | api-ledger | 3: api-ledger#1.5 api-ledger#6.3 api-ledger#6.9 | 3: 4a3abb2 822ab08 1d0f412 | api 9 |
| TRF-05 | Peticiones simultáneas con la misma llave | api-ledger | 1: api-ledger#10.2 | 1: 99c4c5d | api 3 |
| TRF-06 | Propiedad de las cuentas y del beneficiario | api-ledger | 4: api-ledger#6.2 api-ledger#6.4 api-ledger#6.10 (+1) | 4: d8e47ab 6ef5fea 757af5f (+1) | api 17 |
| TRF-07 | Transferencia a la misma cuenta | api-ledger | 6: api-ledger#2.2 api-ledger#2.7 api-ledger#2.9 (+3) | 6: 9d47e3a 945ad31 89ddb7f (+3) | api 9 |
| TRF-08 | Validación del monto sin redondeo | api-ledger | 6: api-ledger#1.1 api-ledger#1.2 api-ledger#6.1 (+3) | 6: 7663863 9d47e3a 945ad31 (+3) | api 13 |
| TRF-09 | Concepto y referencia | api-ledger, ux-fixes | 6: api-ledger#2.2 api-ledger#6.1 api-ledger#6.8 (+3) | 7: 7663863 b79fd1e 1af5ce6 (+4) | api 14 |
| TRF-10 | Rechazo por saldo insuficiente | api-ledger | 4: api-ledger#2.9 api-ledger#6.5 api-ledger#6.8 (+1) | 4: 06ba6b1 945ad31 226fa20 (+1) | api 9 |
| TRF-11 | Límite diario por usuario | api-ledger | 7: api-ledger#1.6 api-ledger#2.6 api-ledger#2.9 (+4) | 7: e140c54 21f79fa 8b547ad (+4) | api 12 |
| TRF-12 | Día del límite en la zona horaria de la Ciudad de México | api-ledger | 4: api-ledger#1.3 api-ledger#6.4 api-ledger#6.11 (+1) | 4: 2de587a 8b547ad 757af5f (+1) | api 13 |
| TRF-13 | Límite diario consistente ante concurrencia | api-ledger | 4: api-ledger#2.6 api-ledger#6.4 api-ledger#10.4 (+1) | 4: 9d47e3a 174a816 757af5f (+1) | api 11 |
| TRF-14 | OTP para montos mayores al umbral | api-ledger | 5: api-ledger#1.4 api-ledger#1.6 api-ledger#7.1 (+2) | 5: 21f79fa 2051b07 59dde1f (+2) | api 10 |
| TRF-15 | Entrega del OTP por correo | api-ledger, security-hardening | 3: api-ledger#7.2 api-ledger#7.6 security-hardening#3.9 | 6: 755b17c f76f47f 6d49730 (+3) | api 14 |
| TRF-16 | Confirmación con OTP | api-ledger | 4: api-ledger#1.4 api-ledger#7.3 api-ledger#7.7 (+1) | 5: 7663863 ed14599 76d6bd5 (+2) | api 9 |
| TRF-17 | Intentos del OTP | api-ledger | 3: api-ledger#1.4 api-ledger#7.3 api-ledger#7.7 | 3: 76d6bd5 8d6e752 ab3a33e | api 5 |
| TRF-18 | Confirmación idempotente por estado | api-ledger | 3: api-ledger#1.4 api-ledger#7.3 api-ledger#7.7 | 3: 76d6bd5 8d6e752 ab3a33e | api 5 |
| TRF-19 | Vencimiento del OTP | api-ledger | 5: api-ledger#1.4 api-ledger#1.6 api-ledger#7.3 (+2) | 5: ade58e3 2de587a 8d6e752 (+2) | api 9 |
| TRF-20 | Reenvío del OTP | api-ledger | 3: api-ledger#1.6 api-ledger#7.4 api-ledger#7.9 | 3: dd2d03c 4cec9fc b39a2a0 | api 10 |
| TRF-21 | Partida doble | api-ledger | 7: api-ledger#2.3 api-ledger#2.4 api-ledger#2.7 (+4) | 9: bfc57a6 20a2ea5 90a5ca7 (+6) | api 11 |
| TRF-22 | Saldos y saldo posterior en la misma transacción | api-ledger | 4: api-ledger#3.1 api-ledger#3.4 api-ledger#6.6 (+1) | 4: 20a2ea5 07e1a09 93bcf62 (+1) | api 4 |
| TRF-23 | Asientos inmutables | api-ledger | 2: api-ledger#2.5 api-ledger#2.8 | 2: 6ffacef 9b35d92 | api 4 |
| TRF-24 | Concurrencia sobre la misma cuenta | api-ledger | 3: api-ledger#6.4 api-ledger#10.1 api-ledger#10.3 | 4: 6265630 1abe16d 06ba6b1 (+1) | api 6 |
| TRF-25 | Auditoría de transferencias | api-ledger | 7: api-ledger#6.5 api-ledger#6.6 api-ledger#6.12 (+4) | 7: f620e6f 4cec9fc 8d6e752 (+4) | api 14 |
| TRF-26 | Consulta de una transferencia como comprobante | api-ledger | 2: api-ledger#8.1 api-ledger#8.2 | 3: ed14599 c4802dc ade58e3 | api 12 |
| TRF-27 | Programación de una transferencia | scheduled-transfers, ux-fixes | 4: scheduled-transfers#2.3 scheduled-transfers#2.4 scheduled-transfers#5.1 (+1) | 9: 3220257 1972769 7663863 (+6) | contract 17, api 20 |
| TRF-28 | Programación con OTP | scheduled-transfers, ux-fixes | 6: domain-test-coverage#2.1 domain-test-coverage#2.2 domain-test-coverage#2.3 (+3) | 9: 3220257 1972769 7663863 (+6) | api 19 |
| TRF-29 | Idempotencia y tope de programadas | scheduled-transfers, ux-fixes | 6: domain-test-coverage#2.1 domain-test-coverage#2.7 scheduled-transfers#2.3 (+3) | 10: 3220257 1972769 7663863 (+7) | api 22 |
| TRF-30 | Ejecución en la fecha programada | scheduled-transfers, ux-fixes | 6: domain-test-coverage#2.4 scheduled-transfers#2.7 scheduled-transfers#2.13 (+3) | 10: 3220257 1972769 7663863 (+7) | api 25 |
| TRF-31 | Ejecución única ante concurrencia | scheduled-transfers | 3: domain-test-coverage#2.4 scheduled-transfers#2.8 scheduled-transfers#2.14 | 5: e93d5b4 726bcd8 70d5bc5 (+2) | api 7 |
| TRF-32 | Cancelación de una programada | scheduled-transfers | 3: domain-test-coverage#2.3 scheduled-transfers#2.10 scheduled-transfers#5.1 | 4: e46a884 e64aaf6 cbd374e (+1) | api 15 |
| TRF-33 | Consulta de las programadas | scheduled-transfers, ux-fixes | 2: scheduled-transfers#2.11 ux-fixes#10.2 | 3: 7663863 27c7a2b 7c79bd4 | api 8 |
| TRF-34 | Estados de las programadas | scheduled-transfers | 4: domain-test-coverage#6.3 scheduled-transfers#2.1 scheduled-transfers#2.3 (+1) | 10: 9d47e3a 45d7e56 b6d5c26 (+7) | api 20 |
| TRF-35 | Aviso de falla de una programada | scheduled-transfers, ux-fixes | 3: domain-test-coverage#2.6 scheduled-transfers#2.9 ux-fixes#10.2 | 4: 7663863 b759e87 36d047f (+1) | api 13 |
| TRF-36 | Auditoría de las programadas | scheduled-transfers | 6: domain-test-coverage#2.5 scheduled-transfers#2.4 scheduled-transfers#2.6 (+3) | 8: e3e44a5 e93d5b4 7a4fee5 (+5) | api 11 |
| TRF-37 | Límites de tasa de las transferencias | security-hardening | 3: security-hardening#2.1 security-hardening#2.3 security-hardening#2.4 | 9: 755b17c d8accf3 b2eb142 (+6) | api 18 |
| TRF-38 | Comprobante al remitente | security-hardening | 3: security-hardening#3.6 security-hardening#3.7 security-hardening#3.8 | 9: 755b17c d8accf3 b2eb142 (+6) | api 25 |
| WEB-01 | Los tokens nunca llegan al navegador | web-app | 4: web-app#2.4 web-app#3.2 web-app#4.1 (+1) | 4: 8077ffa db2c412 8701341 (+1) | web 10 |
| WEB-02 | Atributos de la cookie de sesión | web-app | 2: web-app#2.2 web-app#10.3 | 3: 0cbf6ed 20c81c8 f5cff7c | web 5 |
| WEB-03 | Expiración por inactividad | web-app | 3: web-app#2.1 web-redis-sessions#2.1 web-redis-sessions#2.2 | 5: 3b06a9d cef5421 c96751d (+2) | web 15 |
| WEB-04 | Renovación única del access token | web-app | 2: web-app#2.4 web-redis-sessions#2.2 | 3: 3b06a9d c96751d c34960b | web 7 |
| WEB-05 | Cierre de sesión | web-app | 2: web-app#4.1 web-app#4.6 | 5: cef5421 68f7efd 8f52722 (+2) | web 9 |
| WEB-06 | Protección de las mutaciones contra CSRF | web-app | 4: scheduled-transfers#3.3 web-app#1.2 web-app#10.2 (+1) | 8: 433fa46 27509a1 0cbf6ed (+5) | web 7 |
| WEB-07 | Validación y autorización en cada mutación | web-app | 4: scheduled-transfers#3.3 web-app#1.1 web-app#2.5 (+1) | 5: 433fa46 27509a1 1d400eb (+2) | web 20 |
| WEB-08 | Resultado de las mutaciones como valor | web-app | 3: scheduled-transfers#3.3 web-app#2.5 web-app#5.1 | 5: 433fa46 27509a1 9635f0c (+2) | web 13 |
| WEB-09 | Proxy de lecturas con lista blanca | web-app | 6: account-statements#2.1 scheduled-transfers#3.3 web-app#1.2 (+3) | 9: 6f63631 852e373 433fa46 (+6) | web 14 |
| WEB-10 | Propagación de headers hacia la API | web-app, security-hardening | 3: web-app#2.3 web-app#8.1 security-hardening#4.1 | 6: 755b17c 19cef68 4f135c6 (+3) | web 22 |
| WEB-11 | Registro y verificación de correo | web-app, registration-birth-data, registration-review, ux-fixes | 10: redesign#6.2 web-app#4.2 web-app#4.4 (+7) | 21: e667fa6 c62b858 a4439ad (+18) | web 26 |
| WEB-12 | Inicio de sesión | web-app, registration-review | 5: contract-v1-1#2.1 redesign#6.2 web-app#4.1 (+2) | 8: e667fa6 a4439ad 0f64221 (+5) | web 13 |
| WEB-13 | Resumen de cuentas | web-app, ux-fixes | 2: web-app#6.1 ux-fixes#7.1 | 6: 64d86f3 d548eab 1f484b4 (+3) | web 9 |
| WEB-14 | Historial de movimientos | web-app | 4: account-statements#2.3 redesign#6.4 web-app#6.2 (+1) | 7: b9aeea0 db1bffd 5719ece (+4) | web 15 |
| WEB-15 | Beneficiarios | web-app | 2: web-app#7.1 web-app#7.2 | 4: 221a143 af02f36 05aa62c (+1) | web 9 |
| WEB-16 | Flujo de transferencia | web-app, ux-fixes | 6: redesign#6.5 web-app#8.3 web-app#8.4 (+3) | 16: 64d86f3 1566084 4d5e011 (+13) | web 28 |
| WEB-17 | Una sola transferencia por intento | web-app | 4: web-app#8.1 web-app#8.2 web-app#8.4 (+1) | 9: 274c2c4 e4e52a4 86ab381 (+6) | web 32 |
| WEB-18 | Confirmación con OTP | web-app, ux-fixes | 3: web-app#8.5 web-app#8.7 ux-fixes#5.3 | 7: 64d86f3 e4e52a4 1e8561b (+4) | web 24 |
| WEB-19 | Mensajes por código de error | web-app | 3: redesign#6.5 web-app#5.1 web-app#8.4 | 8: 1566084 4d5e011 1e8561b (+5) | web 8 |
| WEB-20 | Estados de carga, vacío y error | web-app | 5: web-app#1.5 web-app#5.2 web-app#6.1 (+2) | 12: d1f5e8a 221a143 1e8561b (+9) | web 20 |
| WEB-21 | Montos sin floats ni redondeo | web-app, ux-fixes | 5: web-app#1.1 web-app#1.4 web-app#6.1 (+2) | 10: 3220257 1972769 64d86f3 (+7) | web 11 |
| WEB-22 | Rutas protegidas | web-app | 3: web-app#3.2 web-app#4.6 web-app#5.2 | 5: 86ab381 0cbf6ed dcf659f (+2) | web 17 |
| WEB-23 | Accesibilidad básica | web-app | 8: redesign#6.7 web-app#1.3 web-app#1.4 (+5) | 45: 0fbc9da 048ca0b e0be490 (+42) | web 93 |
| WEB-24 | Layout responsivo con dos formas | redesign | 6: redesign#3.6 redesign#5.1 redesign#6.1 (+3) | 26: 0fbc9da 482b0aa 4d9569e (+23) | web 10 |
| WEB-25 | Paridad visual con la app móvil en teléfono | redesign | 5: redesign#5.3 redesign#5.4 redesign#6.6 (+2) | 48: e845649 ecb29f3 d08344c (+45) | web 29 |
| WEB-26 | Navegación del dashboard | redesign, ux-fixes | 5: redesign#3.3 redesign#5.1 redesign#6.1 (+2) | 23: 3220257 1972769 64d86f3 (+20) | web 16 |
| WEB-27 | Navegación de la app en teléfono | redesign | 5: redesign#3.3 redesign#5.1 redesign#6.1 (+2) | 37: 4d9569e e0be490 a93c747 (+34) | web 23 |
| WEB-28 | Inicio rediseñado | redesign, ux-fixes | 4: redesign#3.4 redesign#5.1 redesign#6.3 (+1) | 22: 64d86f3 b79fd1e 405577d (+19) | web 27 |
| WEB-29 | Movimientos agrupados por día | redesign | 3: redesign#3.4 redesign#5.1 redesign#6.4 | 16: 92b8008 43c2ba9 f52d371 (+13) | web 24 |
| WEB-30 | Flujo de transferencia por pasos | redesign | 3: redesign#3.5 redesign#5.1 redesign#6.5 | 22: ecb29f3 321e4e4 1566084 (+19) | web 36 |
| WEB-31 | Pantallas públicas de marca | redesign | 2: redesign#5.1 redesign#6.2 | 9: fd10d6d 167469d e80a052 (+6) | web 7 |
| WEB-32 | Descarga del estado de cuenta | account-statements, ux-fixes | 6: account-statements#2.1 account-statements#2.2 account-statements#2.3 (+3) | 23: 64d86f3 b1ea000 048ca0b (+20) | web 23 |
| WEB-33 | Programar una transferencia | scheduled-transfers, ux-fixes | 6: redesign#P1 redesign#P2 scheduled-transfers#3.2 (+3) | 39: 64d86f3 b1ea000 048ca0b (+36) | web 44 |
| WEB-34 | Página de transferencias programadas | scheduled-transfers, ux-fixes | 8: redesign#P1 redesign#P2 scheduled-transfers#3.1 (+5) | 43: 64d86f3 b1ea000 048ca0b (+40) | web 31 |
| WEB-35 | Recibir dinero | ux-fixes | 1: ux-fixes#7.1 | 2: 64d86f3 b79fd1e | web 8 |
| WEB-36 | Búsqueda de beneficiarios | ux-fixes | 1: ux-fixes#8.2 | 2: 64d86f3 b79fd1e | web 14 |
| WEB-37 | Sesión que sobrevive al reinicio del servidor web | web-redis-sessions | 7: web-redis-sessions#1.1 web-redis-sessions#1.2 web-redis-sessions#2.2 (+4) | 17: c8268c5 3c08507 0a23acf (+14) | web 15 |
| WEB-38 | Headers de seguridad en toda respuesta | security-hardening | 5: security-hardening#4.3 security-hardening#4.5 tooling-fixes#2.1 (+2) | 16: 755b17c 197606e 06c1f9f (+13) | web 12 |
| WEB-39 | Content-Security-Policy con nonce | security-hardening | 6: security-hardening#4.4 security-hardening#4.5 security-hardening#4.6 (+3) | 17: 755b17c 197606e 06c1f9f (+14) | web 17 |
| WEB-40 | Un 429 no cierra la sesión ni se reintenta | security-hardening | 1: security-hardening#4.2 | 7: 755b17c d8accf3 b2eb142 (+4) | web 7 |
| WEB-41 | Icono de la aplicación | tooling-fixes | 2: tooling-fixes#2.2 tooling-fixes#3.1 | 7: 755b17c 3abf76d 197606e (+4) | web 1 |

## Huecos

### Requisitos sin tarea (0)

Ninguno.

### Requisitos sin commit (0)

Ninguno.

### Requisitos sin prueba cuyo título empiece con su ID (0)

Ninguno.

<!-- trace.sh:end -->

## Notas sobre los huecos

Lo anterior se generó con `scripts/trace.sh --check`, que **termina con error** mientras queden huecos; hoy quedan cuatro. Esta sección es manual y el script no la genera. Para regenerar solo la matriz y conservarla: `{ scripts/trace.sh; sed -n '/trace.sh:end/,$p' docs/traceability.md; } > /tmp/t.md && mv /tmp/t.md docs/traceability.md`. Ningún hueco se cubrió con una prueba falsa.

Los cuatro son requisitos de **proceso**, no de comportamiento de la aplicación. Se verifican con un paso del CI o con un script, no con una prueba cuyo título empiece con el ID:

| ID | Por qué no tiene prueba con su ID | Dónde se verifica |
| -- | --------------------------------- | ----------------- |
| `CTR-01` | El escenario es "se ejecuta el lint sobre `openapi.yaml` y no reporta errores". Es una herramienta (Redocly), no código del paquete | Paso "Lint del contrato (CTR-01)" de [`contract.yml`](../.github/workflows/contract.yml) (`npm run lint:contract`). El 2026-10-14 terminó con código 0. Las reglas de forma del contrato (códigos de error `application/problem+json`) las ejercen indirectamente las pruebas de conformidad de la API (PLT-12) |
| `CTR-03` | El escenario es "regenerar los tipos da un resultado idéntico a los versionados" | Paso "Tipos generados al día (CTR-03)" de `contract.yml` (`npm run generate` y `git diff --exit-code -- src/generated`). El 2026-10-14, `npm run generate` no dejó cambios en `src/generated` |
| `CTR-17` | Pide que el paquete tenga su propio pipeline de CI que falle si algo falla | El propio [`contract.yml`](../.github/workflows/contract.yml): filtros de rutas, lint, tipos al día, typecheck, pruebas, build y empaquetado. Que esté en verde se comprueba con la tarea 5.1 de `delivery`, que sigue **pendiente** |
| `PLT-17` | Igual para el CI de `/api`: se dispara con cambios en `api/**` y `contract/**` | [`api.yml`](../.github/workflows/api.yml) (paso "Pruebas unitarias e integración (PLT-17)"). Su estado en verde también depende de la tarea 5.1 |

**Qué haría falta para cerrarlos:** o una prueba que lea los workflows y compruebe sus disparadores y pasos (comprueba la configuración, no el resultado del CI), o aceptar que `trace.sh` admita una lista explícita de requisitos verificados por CI. Ninguna de las dos se hizo: lo primero daría una falsa sensación de cobertura, y lo segundo cambiaría el significado de `--check`. Por eso el comando sigue fallando y los huecos quedan visibles.

**Límites de la matriz:**

- **La columna de commits es una cota.** Cuenta los commits que citan el ID en `Refs:` o que ligan una tarea que lo nombra con `Task:`. Los commits anteriores a la convención o los que no llevan trailers no aparecen, aunque todos los requisitos tienen al menos uno.
- **La columna de pruebas cuenta títulos, no verifica que la prueba pase.** Esa información la da el CI. Además solo detecta títulos de `it`, `test` y `describe` que empiezan con el ID, en `contract`, `api`, `web`, `mobile` y `design-tokens` (esta última no estaba en la tarea 2.4 y se agregó, porque ahí se prueban los requisitos DSG).
- **Las tareas sin marcar cuentan.** Un requisito con una tarea pendiente (por ejemplo, de `redesign`) aparece con tareas aunque no esté terminado. El estado de cada tarea está en su `tasks.md`.
- **El change `redesign` vive en su propia rama de trabajo** (README, tabla de changes); la matriz incluye sus requisitos tal como están en esta rama.
