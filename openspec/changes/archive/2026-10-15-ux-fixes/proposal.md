## Why

Una revisión de uso de la web y la app encontró fricciones que no son errores de lógica, pero que hacen la billetera torpe o permisiva:
- el registro acepta nombres de una palabra, contraseñas débiles, menores de edad y un RFC que no es de la persona de la CURP;
- los montos, la referencia y los códigos de 6 dígitos admiten texto que el contrato rechaza, y el error aparece hasta enviar;
- la referencia es obligatoria aunque casi nunca hay una que poner;
- la barra lateral tiene dos controles para la misma persona (el perfil y "Cerrar sesión");
- la CLABE completa se esconde detrás de un interruptor en cada tarjeta y no hay una forma clara de dar los datos para recibir dinero;
- la lista de beneficiarios no se puede buscar;
- el selector del estado de cuenta ofrece 12 meses aunque la cuenta tenga uno;
- una transferencia programada solo admite fecha y se ejecuta a medianoche;
- la bandeja de Mailpit se vacía cada vez que se recrea el contenedor.

Cada punto cambia una regla ya especificada, así que este change las actualiza en lugar de dejar la especificación atrás del código.

## What Changes

- **Registro.** El nombre pasa a ser un `PersonName` (letras, al menos dos palabras); la contraseña pide 12 a 128 caracteres con una letra y un dígito; el teléfono no empieza con 0 ni 1; la CURP debe ser de una persona de 18 años o más en la Ciudad de México; los primeros 10 caracteres del RFC deben ser los de la CURP; el correo se normaliza. La web agrega "Confirmar contraseña" (solo de interfaz), valida al salir de cada campo y restringe lo que se escribe.
- **Monto.** Solo dígitos y un punto, 2 decimales como máximo, con comas de miles al escribir y sin ellas al enviar (web y móvil).
- **Referencia opcional.** `reference` deja de ser obligatoria; sin ella vale `null` en transferencias, comprobantes y movimientos, y no se imprime en correos ni en el estado de cuenta. Solo dígitos, hasta 7.
- **Códigos de 6 dígitos.** Solo dígitos al escribir y pegar, con teclado numérico y autocompletado de código de un solo uso.
- **Perfil de la barra lateral (web).** Un solo botón con menú que contiene "Cerrar sesión".
- **Recibir (web y móvil).** Acción rápida "Recibir" con una hoja que muestra Titular, Banco, Cuenta y la CLABE completa con "Copiar CLABE" (y "Compartir" en el móvil). Se quita "Mostrar CLABE" de las tarjetas.
- **Búsqueda de beneficiarios (web y móvil).** Campo de búsqueda en el cliente por nombre, alias o CLABE.
- **Estado de cuenta.** Los meses disponibles van del mes de apertura de la cuenta al mes en curso; un periodo anterior responde 422 `DATE_OUT_OF_RANGE` en `/period`.
- **Programadas con hora.** `scheduledFor` es un instante RFC 3339 con precisión de minuto, de 10 minutos a 90 días después de ahora. La web pide fecha y hora; la ejecución ocurre en la primera pasada posterior al instante; los correos muestran fecha y hora de la Ciudad de México.
- **Entorno local.** La bandeja de Mailpit se guarda en un volumen de Docker.
- **Contrato 1.3.0.** Reúne los cambios del contrato; la API, la web y la app lo reinstalan.

**Proyectos que toca:** `/contract`, `/api`, `/web`, `/mobile` y `/docs`. `/design-tokens` no cambia: los textos nuevos viven en las pantallas.

**Historias de usuario:** HU1 (registro), HU3 (beneficiarios), HU4 (transferir, con el bonus de programadas) y HU5 (historial y estado de cuenta).

## Capabilities

### New Capabilities
<!-- Ninguna. -->

### Modified Capabilities
- `api-contract`: reglas del registro y de la referencia (CTR-11, CTR-12, CTR-13), ventana programable como instante (CTR-18) y utilidades de captura y búsqueda de texto (CTR-20, nuevo).
- `identity`: datos del registro (IDN-02).
- `transfers`: referencia opcional (TRF-09) y programación con hora (TRF-27, TRF-28, TRF-29, TRF-30, TRF-33, TRF-35).
- `movement-history`: referencia nula (HIS-03), meses del estado de cuenta (HIS-11, HIS-12).
- `web-app`: registro (WEB-11), resumen de cuentas (WEB-13), flujo de transferencia (WEB-16, WEB-18, WEB-21), navegación (WEB-26), Inicio (WEB-28), estado de cuenta (WEB-32), programadas (WEB-33, WEB-34), y los requisitos nuevos Recibir dinero (WEB-35) y Búsqueda de beneficiarios (WEB-36).
- `mobile-app`: movimientos y comprobante (MOB-06, MOB-13), captura (MOB-08), OTP (MOB-12), Inicio (MOB-19), programadas (MOB-23), y los requisitos nuevos Recibir dinero (MOB-28) y Búsqueda de beneficiarios (MOB-29).
- `api-platform`: entorno local reproducible con la bandeja persistente (PLT-13).

## Impact

- **`/contract`:**
  - `openapi.yaml` (1.3.0): `PersonName`, `Password`, `Phone`, `ScheduledInstant`, `reference` opcional y nula, texto del periodo del estado de cuenta;
  - validadores y esquemas (`registerFormAt`, `scheduledInstantWithin`, `schedulableWindow`), calendario de la Ciudad de México y utilidades de texto;
  - pruebas de paridad y de cada regla.
- **`/api`:**
  - migración `1760800000000-optional-transfer-reference` (`reference` admite `NULL`);
  - migración `1760800001000-scheduled-for-instant` (`scheduled_for` de `date` a `timestamptz`; las filas existentes quedan a las 09:00 de la Ciudad de México; el `down` pierde la hora);
  - registro, creación, ejecutor, correos, historial y estado de cuenta;
  - `docker-compose.yml` con el volumen `mailpit-data`.
- **`/web`:** registro, campos de monto, referencia y código, barra lateral, Recibir, búsqueda, selector de meses y programación con hora.
- **`/mobile`:** campos de monto, referencia y código, Recibir y búsqueda; reinstalación del contrato.
- **`/docs`:** README raíz y de cada proyecto; matriz de trazabilidad.
- **Riesgo:** el contrato cambia el tipo de `scheduledFor` y endurece reglas del registro dentro de una versión menor (ver la decisión sobre el versionado en `design.md`). Se acepta porque los cuatro consumidores viven en este repositorio y se actualizan juntos. La migración de `scheduled_for` es la única con pérdida en su `down`.
