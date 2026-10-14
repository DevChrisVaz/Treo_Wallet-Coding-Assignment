## Why

Una auditoría de cobertura (2026-10-14) cruzó cada escenario de las specs con las pruebas que lo verifican. De los 216 escenarios de dominio (IDN, ACC, BEN, TRF, HIS, AUD), 207 tienen una prueba que ejecuta el WHEN y comprueba cada THEN; 8 quedan cubiertos solo en parte y 1 no tiene prueba. Además, varias reglas que el código sí aplica (límite diario en el camino con OTP, alcance de la llave de idempotencia, reversión ante fallas de auditoría, constraints de la base, siglo de la CURP) no las ejerce ninguna prueba. En una billetera, una regla de dinero sin prueba es una regla que se puede romper sin que el CI lo note.

## What Changes

- **Escenarios faltantes o parciales**: pruebas para TRF-03 (reintento con la misma llave después de confirmar el OTP), TRF-21 (los dos asientos de una transferencia de la API), TRF-09, IDN-01, IDN-12, BEN-07, HIS-08 y HIS-12.
- **Reglas de dinero y límites**: límite diario al crear una transferencia con OTP, repetición de rechazos por límite y de transferencias FAILED, llave de idempotencia por usuario, tope de programadas antes de emitir el OTP, umbral exacto de 10,000.00 en programadas, confirmación de programadas canceladas o ejecutadas y avance del lote del ejecutor.
- **Atomicidad con la auditoría**: reversión cuando falla el evento en los caminos que hoy no la prueban (OTP enviado y reenviado, intentos de OTP, TRANSFER_FAILED, programar, confirmar y cancelar programadas, alta de beneficiario).
- **Sesiones y registro**: revocación de toda la familia de refresh tokens, borde de la ventana de gracia, sucesor revocado, token de un usuario inexistente, logout con token vencido, registro después del límite de reenvíos, registros simultáneos con el mismo email y respuesta idéntica para un email ya verificado.
- **Constraints de la base**: una prueba por tabla que dispara cada CHECK, UNIQUE, FK y privilegio que hoy nadie ejerce contra PostgreSQL, incluido el respaldo del límite diario en la base y la regla de exactamente dos asientos por transferencia.
- **Validaciones de borde**: referencia, concepto, cursor, filtros de fecha de un solo lado, saldo inicial con empate, llaves prohibidas en la metadata de auditoría, validadores de formularios del contrato y el vector de CURP que distingue 1900 de 2000.
- **Paridad de reglas duplicadas**: CLABE, CURP y RFC existen en la API y en el contrato; una prueba comprueba que ambos coinciden sobre los mismos vectores.
- **Pruebas que no podían fallar**: la barrera de la carrera del tope de programadas.

Solo se agregan o corrigen pruebas. No cambia el código de producción ni el comportamiento del sistema, por eso el change declara `skip_specs: true`. Si una prueba descubre que una regla no se cumple, no se corrige aquí: se registra y se decide aparte.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

Ninguna. Las pruebas verifican requisitos que ya existen en `api-foundation`, `api-ledger`, `account-statements`, `scheduled-transfers` y `openspec/specs/api-contract`.

## Impact

- **Proyectos que toca:** `/api` (pruebas unitarias, de integración y vectores) y `/contract` (pruebas y vectores). No toca `/web`, `/mobile` ni `/design-tokens`, ni código de producción.
- **Historias de usuario:** refuerza HU1 (registro e inicio de sesión), HU2 (cuentas y saldo), HU3 (beneficiarios con CLABE), HU4 (transferencias, incluidas las programadas), HU5 (historial y estado de cuenta) y HU6 (límite diario y OTP).
- **CI:** las suites de `/api` y `/contract` crecen; ningún workflow cambia.
