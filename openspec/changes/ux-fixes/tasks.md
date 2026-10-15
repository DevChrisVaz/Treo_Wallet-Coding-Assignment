Requiere `contract-v1-2` y `scheduled-transfers`. La tarea 1.1 va antes de que cualquier consumidor instale 1.3.0; las migraciones de la API (4.2 y 10.2) van antes de las pruebas de integración que las usan.

## 1. Contrato 1.3.0

- [x] 1.1 [contract] Subir el contrato y su paquete a 1.3.0 (`info.version`) y reinstalarlo en la API, la web y la app con `file:../contract` (CTR-02)

## 2. Registro

- [x] 2.1 [contract] `PersonName`, `Password` y `Phone` en `openapi.yaml`; esquema de registro con correo normalizado, mayoría de edad en la Ciudad de México y coincidencia RFC y CURP en `/rfc`; vectores de paridad y pruebas por regla (CTR-11, CTR-12, CTR-13)
- [x] 2.2 [api] Esquema del registro con las mismas reglas y el reloj inyectado; pruebas unitarias y de integración de cada rechazo y de los límites de edad (IDN-02)
- [x] 2.3 [web] "Confirmar contraseña" solo de interfaz, validación al salir de cada campo, CURP, RFC y teléfono restringidos al escribir y errores del servidor por campo; pruebas de componentes (WEB-11)

## 3. Monto

- [x] 3.1 [contract] Saneamiento del monto al escribir (`sanitizeAmountTyping`) con texto para mostrar y monto para enviar; pruebas de la tabla de casos y de idempotencia (CTR-20)
- [x] 3.2 [api] Pruebas de que letras, símbolos y tres decimales responden 422 en `/amount` y no crean nada (TRF-08)
- [x] 3.3 [web] `AmountField` con solo dígitos y punto, comas de miles y cursor estable; pruebas del campo y del formulario (WEB-21)
- [x] 3.4 [mobile] `AmountField` con el mismo saneamiento y formato; pruebas del campo y del formulario de transferencia (MOB-08)

## 4. Referencia opcional

- [x] 4.1 [contract] `reference` opcional en la petición y nula en `Transfer` y `Movement`; el esquema la acepta ausente o vacía; pruebas de paridad (CTR-12, CTR-13)
- [x] 4.2 [api] Migración `1760800000000-optional-transfer-reference`; casos de uso, huella de idempotencia, vistas, correos y PDF sin imprimir "null"; pruebas de punta a punta (TRF-09, HIS-03, HIS-12)
- [x] 4.3 [web] "Referencia (opcional)" solo con dígitos, omitida si está vacía, "Sin referencia" en el resumen y comprobante sin la fila; pruebas (WEB-16)
- [x] 4.4 [mobile] Campo, revisión, comprobante y renglón de movimiento sin referencia; pruebas (MOB-06, MOB-08, MOB-13)

## 5. Códigos de 6 dígitos

- [x] 5.1 [contract] `digitsOnly` recortado a la longitud del código y vectores de código de 5, 6 y 7 dígitos (CTR-12, CTR-20)
- [x] 5.2 [api] Pruebas de que un código de verificación y un OTP con letras, 5 o 7 dígitos responden 422 sin consumir intentos (IDN-06, TRF-16)
- [x] 5.3 [web] `OtpField` con solo dígitos, máximo 6, teclado numérico y `autocomplete="one-time-code"`; pruebas (WEB-18)
- [x] 5.4 [mobile] `OtpField` con el mismo comportamiento; pruebas (MOB-12)

## 6. Perfil de la barra lateral

- [x] 6.1 [web] Perfil como un solo botón con menú (`role="menu"`) que contiene "Cerrar sesión", con truncado, Escape, clic fuera, flechas y foco; pruebas de componentes y de `AppFrame` (WEB-26)

## 7. Recibir

- [x] 7.1 [web] Acción "Recibir", hoja "Recibir dinero" con selector de cuenta y "Copiar CLABE", y tarjetas con la CLABE enmascarada sin "Mostrar CLABE"; pruebas (WEB-13, WEB-28, WEB-35)
- [x] 7.2 [mobile] Acción "Recibir", hoja con "Copiar CLABE" y "Compartir", y tarjetas con la CLABE enmascarada; pruebas (MOB-19, MOB-28)

## 8. Búsqueda de beneficiarios

- [x] 8.1 [contract] `matchesBeneficiary` y `normalizeForSearch` con sus pruebas (CTR-20)
- [x] 8.2 [web] `SearchField` y `BeneficiarySearch` en la página de Beneficiarios y en el paso de destinatario, con "Sin resultados" y "Limpiar búsqueda"; pruebas (WEB-36)
- [x] 8.3 [mobile] Campo de búsqueda en el paso de destinatario con los mismos estados; pruebas (MOB-29)

## 9. Meses del estado de cuenta

- [x] 9.1 [api] Periodo anterior al mes de apertura en 422 `DATE_OUT_OF_RANGE` en `/period`, sin auditar y con la cuenta ajena en 404; pruebas de integración (HIS-11)
- [x] 9.2 [web] Selector del mes de apertura al mes en curso (mes de la Ciudad de México), mensaje del 422 y pruebas de los casos de uno y de muchos meses (WEB-32)

## 10. Programadas con hora

- [x] 10.1 [contract] `ScheduledInstant`, ventana de 10 minutos a 90 días, calendario con fecha y hora y esquema con ventana; pruebas de límites y de desfases (CTR-13, CTR-18)
- [x] 10.2 [api] Migración `1760800001000-scheduled-for-instant`; validación con el reloj, huella por instante, ejecutor con `scheduled_for <= now()` y correos con fecha y hora; pruebas de límites, de la restricción de minuto y de la huella (TRF-27, TRF-28, TRF-29, TRF-30, TRF-33, TRF-35)
- [x] 10.3 [web] Fecha y hora lado a lado, instante de la Ciudad de México, revisión, resultado, lista y comprobante con fecha y hora; pruebas (WEB-33, WEB-34)
- [x] 10.4 [mobile] Contrato 1.3.0 y comprobación de que la app no ofrece programar (MOB-23)

## 11. Entorno local

- [x] 11.1 [api] Volumen `mailpit-data` y `MP_DATABASE` en `docker-compose.yml` para que la bandeja sobreviva al reinicio (PLT-13)

## 12. Documentación

- [x] 12.1 [docs] README raíz y de cada proyecto con el comportamiento nuevo, la lista de migraciones y el contrato 1.3.0; notas de los lienzos con los requisitos en lugar de etiquetas internas; matriz de trazabilidad regenerada
