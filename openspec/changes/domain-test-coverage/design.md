## Context

La auditoría de cobertura del 2026-10-14 revisó escenario por escenario las specs de dominio contra las pruebas y midió la cobertura de líneas y ramas de `/api` (96.5 % de líneas, 86.7 % de ramas) y `/contract` (96.8 % y 84.0 %). Las brechas son pruebas, no funcionalidad: el código ya existe y pasa en CI. Este change agrega las pruebas que faltan sin tocar el código de producción.

## Goals / Non-Goals

**Goals:**

- Que cada escenario de dominio tenga una prueba que ejecute su WHEN y compruebe cada THEN.
- Que cada regla de dinero, límite, idempotencia, auditoría y constraint de la base tenga al menos una prueba que falle si la regla se quita.

**Non-Goals:**

- Corregir defectos que las pruebas descubran (se registran y se deciden aparte).
- Cambios de comportamiento ya conocidos: `deliveryStatus` sin guardar, la máquina de estados de transferencias sin usar en producción, la herramienta de detección de cambios incompatibles del contrato (CTR-02).
- Requisitos de plataforma (PLT) y de clientes (WEB, MOB, DSG).

## Decisions

### D1. Prueba escrita después del código, demostrada con una mutación

El código ya existe, así que una prueba nueva pasa desde el primer intento y por sí sola no demuestra nada. Para cada prueba se rompe a propósito la regla en el código de producción (se borra la guarda, se cambia el operador del borde, se quita el evento de auditoría), se confirma que la prueba falla por la razón esperada y se restaura el archivo con `git checkout`. El commit solo lleva la prueba, y su cuerpo dice qué mutación la hace fallar.

- _Alternativa descartada:_ mutation testing automatizado (Stryker). Da una medida global, pero tarda horas sobre una suite de integración con PostgreSQL real y no apunta a las reglas que la auditoría señaló.
- _Alternativa descartada:_ confiar en que la prueba pasa. Es justo lo que dejó las pruebas que no podían fallar (la barrera de la carrera del tope de programadas).

### D2. Una base de datos y un Mailpit por línea de trabajo

Las pruebas de integración reinician las tablas de `wallet_test` y vacían la bandeja de Mailpit, y corren un archivo a la vez por eso. Para trabajar en paralelo, cada línea de trabajo usa su propio contenedor de PostgreSQL 16 (con el mismo `db/bootstrap.sql`) y su propio Mailpit, configurados en el `.env` de su copia de trabajo. En CI no cambia nada.

- _Alternativa descartada:_ varias bases `wallet_test_*` en el mismo servidor. Las pruebas de concurrencia abren decenas de conexiones y cinco suites juntas superan `max_connections` (100); además las pruebas del bootstrap esperan exactamente `wallet` y `wallet_test`.

### D3. Constraints de la base en una prueba por tabla

Cada CHECK, UNIQUE, FK y privilegio se dispara con un `INSERT` o `UPDATE` directo como `wallet_migrator` o `wallet_app` y se comprueba por el nombre de la constraint (`ck_`, `uq_`, `fk_`) o por el SQLSTATE 42501. Las filas de cada caso se arman a partir de una fila válida a la que se le cambia un solo campo, para que la falla venga solo de la constraint que se prueba.

- _Alternativa descartada:_ probarlas solo a través de la API. La API valida antes y la constraint nunca se alcanza; justo por eso la auditoría las encontró sin probar.

### D4. Si una prueba descubre un defecto

No se corrige el código ni se deja una prueba en rojo. Se registra el hallazgo (regla, archivo, evidencia) en el reporte del change y se decide con el usuario si se abre un change que lo corrija.

## Risks / Trade-offs

- [Las pruebas de concurrencia dependen del tiempo y pueden fallar si la máquina está cargada] → Antes de dar una falla por real, se repite ese archivo solo.
- [La prueba de HIS-08 con 60000 movimientos alarga la suite] → Reutiliza el seed de volumen que ya arma `history-plans.test.ts` en vez de crear otro.
- [La paridad API–contrato duplica vectores] → Los vectores compartidos viven en una sola lista dentro de la prueba de paridad; los existentes no se tocan.
