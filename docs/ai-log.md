# Bitácora de uso de AI

Registro honesto de cómo se usó la AI en esta prueba: qué herramienta, los prompts clave, qué propuso la AI que rechacé y por qué, y dónde tuve que corregirla. Se actualiza en cada sesión de trabajo.

## Herramientas

| Herramienta | Uso |
|---|---|
| **Claude Code** (modelo Claude Opus 5.5) | Exploración del alcance, redacción de las especificaciones, implementación y revisión |
| **OpenSpec 1.8** (schema `spec-driven`) | Modo SPEC: cada parte del sistema es un *change* con `proposal → specs → design → tasks`, que se implementa con `/opsx:apply` y se archiva con `/opsx:archive` |

**Flujo spec-first:** primero `/opsx:explore` para decidir el alcance y las ambigüedades; después se capturan los seis changes completos (todos especificados antes de escribir código de aplicación); al final se implementa change por change.

**Desviaciones del enunciado decididas por mí, no por la AI:**
- No hay carpeta `/specs`. Las especificaciones viven donde OpenSpec las define (`openspec/specs/` y `openspec/changes/`), y el README incluye un mapa para navegarlas.
- No hay monorepo. Son cuatro proyectos independientes (`/contract`, `/api`, `/web`, `/mobile`) que se separarán en repositorios propios.

---

## Sesión 1 — 2026-10-13 · Exploración de alcance

**Prompts clave:**
- `/opsx:explore @"Prueba Técnica — …md" necesito realizar esa actividad pero vamos a definir alcance primero`
- "Vamos a explorar las ambigüedades y los defaults una por una"

**Lo que detectó la AI al leer el enunciado:**
- El nombre del archivo dice *Backend Developer*, pero el contenido es la prueba de *Fullstack Developer* (con web y móvil). Confirmé que el rol es fullstack con enfoque en backend.
- Ninguna historia de usuario explica cómo entra el dinero al sistema. En un ledger de partida doble eso no puede quedar implícito.
- El enunciado no define: el formato del dinero, a qué apunta la CLABE de un beneficiario, si el OTP retiene fondos, el alcance del límite diario (usuario o cuenta, zona horaria) ni qué se crea al registrarse.

### Propuestas de la AI que acepté

| Tema | Decisión |
|---|---|
| Origen del dinero | Cuenta SYSTEM "Tesorería" que fondea con asientos de apertura (seed y `db:fund`), sin endpoint de depósito |
| CLABE | Las cuentas tienen una CLABE generada; el beneficiario debe corresponder a una cuenta existente de la plataforma; dígito verificador validado también en la base |
| OTP | Sin retención de fondos: la transferencia queda pendiente sin asientos y todo se revalida al confirmar |
| Límite diario | Por usuario, solo transferencias a terceros, día calendario en `America/Mexico_City`, con una fila contador protegida por `CHECK` |
| Dinero | `BIGINT` en centavos, strings decimales en JSON, nunca floats y nunca redondear (lo inválido se rechaza) |
| Concurrencia | `SELECT … FOR UPDATE` en orden determinista en lugar de `SERIALIZABLE` |
| Idempotencia | Llave como columna de `transfers` con `UNIQUE`; los rechazos de negocio se guardan como `REJECTED` |
| Auditoría | `audit_log` y `ledger_entries` solo de inserción, con roles de base de datos separados y `TRUNCATE` también revocado |
| Errores | RFC 9457 (sucesor compatible del 7807) con un catálogo de `code` cerrado |

### Propuestas de la AI que rechacé o modifiqué

| La AI propuso | Decidí | Por qué |
|---|---|---|
| Escribir a mano una carpeta `/specs` como fuente única | Usar OpenSpec tal como funciona, sin `/specs` | OpenSpec es mi herramienta de especificación y no quiero duplicar artefactos |
| Monorepo con `/packages/shared`, como sugiere el enunciado | Cuatro proyectos independientes, sin dependencias de código entre sí | Cada proyecto tendrá su propio CI y luego su propio repositorio |
| Eximir del OTP las transferencias entre cuentas propias | Toda transferencia mayor a 10,000 MXN pide OTP, sin excepciones | No quiero ningún camino exento del segundo factor |
| Entregar el OTP por consola | Primero lo cambié a `devOtp` en la respuesta y después a **correo vía Mailpit** | El correo es más realista y elimina el riesgo de que `devOtp` llegue a producción |
| Aceptar el 409 de "email ya registrado" como riesgo documentado | Verificación por correo: el registro responde 202 siempre y los tokens se entregan al verificar | Elimina la enumeración de cuentas por email |
| Registro solo con email, contraseña y nombre | CURP, RFC y teléfono obligatorios y únicos (validación de formato, sin KYC) | Realismo del dominio financiero mexicano |
| Refresh token en cookie `httpOnly` emitida por la API | **BFF** en Next.js con la sesión guardada en el servidor | Los tokens nunca llegan al navegador |
| Mutaciones del BFF con *route handlers* | **Server Actions** | Protección CSRF incluida y validación compartida entre formulario y acción |
| Copias del contrato en cada cliente, sincronizadas desde una URL | **Paquete de contrato** (`/contract`) que consumen los otros tres proyectos | Elimina la duplicación de validadores y tipos |
| Distribuir el paquete como tarball dentro de cada consumidor | `file:../contract` mientras todo esté en un solo repositorio, y GitHub Packages cuando se separen | Más simple hoy y con un camino claro para mañana |
| Posponer la verificación de correo y `remaining`, y poner límites de tiempo, para ajustarse a las 10–14 h | Mantener el alcance completo y aceptar unas 18–24 h | Prefiero entregar el diseño completo y documentar el costo |

### Riesgos de dinero y seguridad que la AI señaló antes de implementar

- **Floats:** `Math.round(1.005 * 100)` da `100`, así que se pierde un centavo. PostgreSQL además redondea en silencio al convertir a `numeric(19,2)` o a `bigint`. Por eso los montos solo se aceptan como string y se validan en la entrada.
- **Límite diario calculado en UTC:** el "día" se reiniciaría a las 18:00 hora de México.
- **Carrera en el límite diario:** con locks por cuenta, dos transferencias simultáneas desde cuentas distintas del mismo usuario podían superarlo. Se resolvió con la fila contador por usuario.
- **IDOR en `fromAccountId`:** sin verificar la propiedad de la cuenta, un usuario podría vaciar la cuenta de otro. La propiedad se verifica en la misma consulta que toma el lock.
- **`now()` en PostgreSQL devuelve la hora de inicio de la transacción:** el timestamp se toma después de obtener los locks.
- **Rotación estricta del refresh contra la red móvil inestable:** se agregó una ventana de gracia de 30 segundos.
- **Con el BFF, la API ve la IP del BFF:** solo se confía en `X-Forwarded-For` cuando viene del BFF o del ALB.

**Correcciones a la AI en esta sesión:** ninguna sobre dinero todavía; la sesión fue de diseño. Esta sección se llena durante la implementación.

### Captura de las especificaciones

**Cómo se hizo:** escribí primero el contrato (`contract/openapi.yaml`, validado con Redocly) y `openspec/config.yaml`. Después se redactaron los seis changes con agentes de Claude Code en paralelo, uno por change, cada uno con todas las decisiones de la exploración. Cada change pasó `openspec validate --strict`.

**Correcciones que la AI hizo a su propio diseño al bajarlo al detalle:**
- **Deadlock en el bloqueo de cuentas.** El diseño acordado usaba `SELECT … FOR UPDATE` sobre las cuentas. Al insertar la transferencia, su llave foránea toma `FOR KEY SHARE` sobre esas mismas cuentas, lo que choca con el `FOR UPDATE` de otra transacción y produce un deadlock real. Se cambió a `FOR NO KEY UPDATE`, que sigue serializando los cambios de saldo sin chocar con las llaves foráneas.
- **Cambio de día mientras se espera el lock.** El orden de bloqueo (contador → transferencia → cuentas) obliga a saber el día antes del primer lock, pero la hora de la operación se toma después de todos. Si el día cambia mientras se espera, se hace `ROLLBACK` y se reintenta una vez.
- **Hash de los códigos OTP.** Un código de 6 dígitos guardado con un hash simple se revierte por fuerza bruta si la tabla se filtra. Se guarda con HMAC-SHA256 y un secreto del servidor.

**Lo que corregí en la revisión cruzada** (cada change estaba bien por separado, pero no coincidían entre sí):
- La columna de saldo se llamaba distinto en `api-foundation` y en `api-ledger`; quedó `balance_cents`.
- Faltaba el propósito `TRANSFER_CONFIRMATION` en los códigos de un solo uso.
- `api-ledger` creaba sus propios triggers de inmutabilidad en lugar de reutilizar `forbid_mutation()`.
- El seed no incluía beneficiarios para Ana, y la app móvil solo puede transferir a beneficiarios ya registrados.
- La API no declaraba que escucha en `0.0.0.0`, que el móvil necesita para alcanzarla por la red local.
- El rate limiting no contemplaba una llave por usuario, que `api-ledger` necesita para el alta de beneficiarios.
- El contrato no tenía un vocabulario cerrado para los errores por campo (`FieldErrorCode`) ni explicaba que los depósitos de la Tesorería no tienen comprobante.

**Dependencias que agregó la AI y acepté:** `expo-crypto`, porque Hermes no trae `crypto.randomUUID` para generar la llave de idempotencia, y `expo-screen-capture`, para que Android tampoco muestre el contenido sensible al cambiar de app.

### Revisión de las decisiones de AWS

**Prompt clave:** "Exploremos las decisiones de AWS: ¿Por qué Fargate en vez de Amplify?"

**Dónde tuve que corregir a la AI:** la propuesta original descartaba Amplify Hosting con dos argumentos. Pedí verificarlos contra la documentación actual de Amplify:
- "El cómputo SSR de Amplify no llega a ElastiCache dentro de la VPC": **probablemente cierto**, porque Amplify accede a otros servicios por un SSR Compute Role de IAM y no por red privada. Pero **no era decisivo**: con las sesiones en DynamoDB funcionaría igual.
- "Amplify deja menos control de cabeceras y de `serverActions.allowedOrigins`": **falso**. `allowedOrigins` es configuración de Next y funciona en cualquier hosting, Amplify permite headers personalizados y además se integra con AWS WAF.

**Resultado:** se mantuvo Fargate, pero con los argumentos que sí pesan:
1. La API puede confiar en `X-Forwarded-For` por el CIDR de la red del BFF, lo que sostiene el rate limiting del login por IP. Con Amplify haría falta un header firmado con HMAC.
2. Amplify documenta soporte de SSR solo para Next.js 12 a 15, y la web usa la 16.
3. Es la misma plataforma operativa que la API.
4. Mantiene la postura de red de una empresa regulada.

Amplify quedó documentado como alternativa válida, con sus condiciones: sesiones en DynamoDB, header firmado y Next 15.

**Lección:** una justificación que suena razonable no basta. Las afirmaciones de la AI sobre servicios en la nube se verifican con la documentación antes de aceptarlas.

---

## Sesión 2 — 2026-10-13 · Implementación de `contract-v1`

**Prompt clave:** "Procedamos con contract-v1" → `/opsx:apply contract-v1`, con TDD: cada prueba se escribió primero y se vio fallar antes de implementar. Un commit por tarea, con los trailers `Task:` y `Refs:`.

**Decisiones de versiones tomadas al implementar:**
- **TypeScript 5.9, no 7.** TypeScript 7 (el port nativo) ya es la versión `latest`, pero openapi-typescript pide `^5.x` y typescript-eslint `<6.1`.
- **Herramientas en Node 24.** Vitest 5 ya no soporta Node 20, y además Node 20 llegó al fin de su soporte en abril de 2026. El paquete construido sí se prueba en Node 20, 22 y 24 con la prueba de humo, así que se cumple "Node 20 o superior".

**Errores de la AI que detectaron las pruebas o la verificación:**
- **`exports` apuntaba a un `index.d.mts` que tsup no genera.** Lo corrigió al revisar la salida del build y, para que no vuelva a pasar inadvertido, agregó `check:exports`, que falla si cualquier ruta declarada en `package.json` no existe.
- **Un commit con un archivo sin formatear.** El comando de verificación terminaba en `prettier --check . | tail -1`, y la tubería ocultaba el código de salida de Prettier. Se corrigió ese commit, que aún no se había compartido, y desde entonces se verifica sin canalizar la salida.
- **Un número JSON se reportaba como `REQUIRED` en lugar de `INVALID_TYPE`.** Zod 4 no incluye el valor recibido en sus errores de tipo. La prueba con vectores lo detectó; la solución fue revisar presencia y tipo de forma explícita (`textField`), sin deducirlos del mensaje.

**Lo que la AI propuso cambiar respecto a la especificación, y acepté:**
- **La tarea 4.2 pedía una "prueba estática"** que buscara `Number`, `parseFloat` o `Intl` en el código de `formatMXN`. Eso solo prueba el texto del archivo, no su comportamiento. Se reemplazó por dos pruebas de comportamiento: un monto por encima de 2^53 (un float lo alteraría) y el mismo resultado con `Intl` ausente. Se actualizó la descripción de la tarea en `tasks.md`.

**Cómo se verificó que las pruebas sí detectan errores** (mutaciones temporales, revertidas después):
- Ampliar la referencia a 8 dígitos en el yaml, o contar el concepto con `.length` en lugar de puntos de código: la prueba de paridad falla.
- Implementar `formatMXN` con `Intl` y `Number`: fallan la prueba de precisión y la de entorno sin `Intl`.
- Forzar `install-links=false`: `verify:install` detecta el enlace simbólico.

**Corrección del scope del paquete:** la AI nombró el paquete `@morgandevchrisvaz/wallet-contract` a partir de `gh api user`, que devuelve la cuenta con sesión iniciada en la CLI de GitHub de esta máquina, y lo presentó como mi usuario sin confirmarlo. Mi usuario es **DevChrisVaz**, así que el scope correcto es `@devchrisvaz` (GitHub Packages exige que el scope sea el dueño del repositorio, en minúsculas). Se renombró en el paquete, el contrato, el README y las especificaciones, y se volvió a verificar todo. **Lección:** los datos de identidad (usuario, scope, correo) se le confirman a la persona; no se deducen del entorno.

---

## Sesión 3 — 2026-10-13 · Puertos, sistema de diseño y trabajo en paralelo

**Prompt clave:** "Ahora que ya tenemos el contrato, podemos trabajar web, mobile y api en paralelo. Para los clientes necesitamos definir un design system para mantener coherencia y finalmente despachar a subagentes a realizar los cambios."

**Puertos.** La AI detectó que Next.js usa el 3000 por defecto, el mismo puerto que el contrato asignaba a la API, y que en mi máquina el 3000 y el 5432 ya estaban ocupados. Acepté su propuesta: API en el 4000 y PostgreSQL de docker compose en el 5433 (contrato 1.0.1).

**Sistema de diseño.** La AI propuso tres direcciones visuales y yo le pedí investigar el design system de treo.mx. Extrajo del HTML y del kit de Elementor del sitio la paleta, la tipografía (Work Sans) y las formas, y calculó el contraste WCAG de cada combinación:
- El verde de marca de Treo (`#31C454`) da 2.29:1 como texto y su gris (`#7E7E7E`) 4.06:1. Ninguno cumple AA, así que se usan solo como referencia y se agregaron texto secundario accesible y colores de estado.
- La AI no publicó el sistema como artefacto web, porque reproduce la identidad de una empresa real. Quedó como archivos en el repositorio: el paquete `/design-tokens` y una referencia visual local.
- Elegí el nombre **TreoWallet**, que se muestra como logotipo de texto, sin usar el logo de Treo.

**Errores de la AI que detectaron las pruebas:**
- **El borde de los campos que propuso la AI (`#8A958D`) cumplía 3:1 sobre blanco, pero no sobre las superficies arena y verde** (2.85 y 2.83). Lo detectó la prueba de contraste, que recorre todos los pares declarados; se oscureció a `#7F8A82`.
- La AI cambió `Object.hasOwn` por `hasOwnProperty` de forma preventiva, porque el paquete también corre en Hermes.

**Verificaciones más allá de las pruebas unitarias:** la hoja generada para Tailwind v4 se compiló con el CLI real. Existen las utilidades del sistema, y `bg-red-500` y `text-sm` no se generan, lo que comprueba que los clientes no pueden salirse de la paleta. La referencia visual se revisó renderizada en un navegador.

**Trabajo en paralelo.** API, web y móvil se implementan con tres subagentes de Claude Code, cada uno en su propio worktree de git, a partir de los artefactos de OpenSpec. El de la API arrancó antes, porque no necesita el sistema de diseño; los de web y móvil, en cuanto `/design-tokens` estuvo listo. Integro yo las ramas al terminar.

### Integración de web y móvil

**Interrupción.** Los tres subagentes se detuvieron a la vez al llegar al límite de uso de la sesión, cada uno a mitad de una tarea. Se reanudaron con su contexto, con la instrucción de comprobar el trabajo sin commit contra el ciclo de TDD antes de terminar la tarea.

**Verificación antes de integrar.** La AI principal no se basó en los reportes:
- Volvió a correr typecheck, lint, formato y pruebas de cada rama. Web: 382 pruebas. Móvil: 200.
- Revisó que todos los commits usaran mi identidad y llevaran los trailers.
- Revisó que ninguna rama tocara archivos de otro proyecto.

Después integró con `--no-ff`: web 35/36 tareas, móvil 32/33.

**Errores de la AI que detectaron las pruebas:**
- **Transferencias sin `Idempotency-Key` (móvil).** En Jest, `randomUUID` de expo-crypto devolvía `undefined`, y openapi-fetch omite un header vacío sin avisar. Lo detectó una prueba de pantalla. Ahora la máquina de estados falla si no hay llave, y las pruebas exigen un UUID v4.
- **Todas las llaves iguales (web).** Un generador que se recreaba en cada render hacía que todas las llaves salieran iguales.
- **Zod 4 (web).** `.default()` devolvía el texto sin transformar, así que `SESSION_COOKIE_SECURE` quedaba como cadena.
- **Accesibilidad (web):**
  - el nombre accesible de un botón incluía el texto oculto "Enviando…";
  - dos controles se llamaban "Beneficiario".
- **Herramientas de prueba (móvil):**
  - `fireEvent` se usó como síncrono, pero en Testing Library v14 es asíncrono;
  - los temporizadores de TanStack Query mantenían vivo a Jest 300 s;
  - una prueba con temporizadores falsos fallaba de forma intermitente.

**Fallas que la AI encontró a mano en la web:**
- **`next dev` registraba la contraseña** en los argumentos de la Server Action de inicio de sesión. Se apagó con `logging.serverFunctions: false`, con una prueba que lo cubre.
- **`next dev` escribía un `AGENTS.md`** en el proyecto. Se apagó con `agentRules: false`.

**Cómo se verificó que las pruebas sí detectan errores.** Ambos subagentes hicieron mutaciones temporales y las revirtieron después. Todas hicieron fallar alguna prueba:
- generar una llave nueva al reintentar;
- quitar la renovación única del token;
- quitar la protección contra el doble envío;
- volver reintentables los 4xx;
- usar `>=` en el umbral del OTP;
- formatear con `parseFloat().toFixed`;
- borrar los tokens después de llamar a la API;
- quitar la vigencia absoluta de la sesión;
- quitar la pantalla de privacidad del layout raíz;
- escribir a mano un color.

**Huecos en trabajo anterior de la AI que encontraron los subagentes:**
- **La salida CommonJS de `/contract` está rota.** `createApiClient` falla con `require` ("import_openapi_fetch.default is not a function"). La prueba de humo solo comprobaba que la función existiera, no que funcionara. No afecta a los clientes, que usan la salida ESM, y no se ha corregido.
- **`ProblemError` no conserva `Retry-After`.** Ambos clientes lo resolvieron con un middleware propio.
- **Textos de los escenarios desactualizados.** Al crear el sistema de diseño, la AI no actualizó los textos literales de los escenarios de `web-app` y `mobile-app`, que quedaron distintos de `problemMessage`. Ambos clientes muestran el texto del paquete:
  - El subagente móvil actualizó sus escenarios (nota N2).
  - El web lo dejó documentado sin cambiar la spec (D17).

**Colisión de herramientas.** Los dos subagentes compartían el directorio temporal de la sesión, y el de web sobrescribió un script de simulación de CI del de móvil. El de móvil lo detectó, movió sus scripts a una carpeta propia y revisó que su árbol no tuviera cambios ajenos.

**Pendiente de verificación manual:**
- **Móvil 6.3:** prueba en un teléfono con Expo Go. La hago yo.
- **Web 9.2:** teclado y Lighthouse. Se hizo contra una API simulada con la forma del contrato y falta repetirla contra la API real.

### Correcciones tras la integración

Decidí alinear los textos de las specs con el paquete de diseño y corregir el contrato en ese momento, con una versión 1.1.0.

**Textos.** Los escenarios de `web-app` ahora citan el mensaje de `problemMessage` más el dato variable que agrega la web, igual que ya hacía `mobile-app`.

**Change `contract-v1-1`** (5 tareas, TDD):
- **Salida CommonJS.** Primero se amplió la prueba de humo para que cree un cliente y haga una petición con `import` y con `require`; falló con `require`. Después se corrigió el interop con el `default` de openapi-fetch. Pasa en Node 20, 22 y 24.
- **`ProblemError.retryAfter`.** Las pruebas cubren `300`, la ausencia del header y cinco valores inválidos. Una mutación temporal con un parser permisivo hizo fallar los casos `-5` y `1.5`.
- **Clientes.** Web y móvil eliminaron sus middlewares y leen `error.retryAfter`. Sus pruebas de WEB-12 y MOB-01 pasaron sin cambios. Quitar `retryAfter` del camino hizo fallar esas pruebas.

**Errores de la AI en esta parte:**
- **Una tubería volvió a ocultar un código de salida.** `check:version | tail` mostró `exit: 0` con las versiones desalineadas. La AI lo notó y repitió la verificación sin la tubería, que sí dio 1.
- **Perdió una edición sin commit.** Para revertir una mutación en `action.ts` usó `git checkout`, que también descartó su propia edición sin commit de ese archivo. Lo detectó al revisar el archivo y la volvió a aplicar. Las mutaciones siguientes se revirtieron desde una copia del archivo.

**Hallazgo de npm.** Al reinstalar el paquete con `file:`, npm instala la versión nueva pero conserva la anterior en el lockfile, porque la ruta no cambia. Se actualizó con `npm install @devchrisvaz/wallet-contract@file:../contract`.

### Integración de la API

El subagente de la API terminó `api-foundation` (48/48) y `api-ledger` (69/69) en 123 commits.

**Verificación antes de integrar.** La AI principal hizo las mismas revisiones que con web y móvil:
- Volvió a correr en el worktree lint, typecheck, formato, build y las 713 pruebas, con PostgreSQL y Mailpit reales.
- Revisó que todos los commits usaran mi identidad y llevaran trailers.
- Revisó que la rama solo tocara `api/`, su workflow y sus dos changes.

Después de integrar, reinstaló el contrato 1.1.0 en `/api` y repitió las pruebas: siguen pasando las 713.

**Comprobaciones con datos reales:**
- **Seed.** `db:seed` crea 120,128 asientos en 10.7 s, y la segunda corrida no agrega nada.
- **Historial.** Los planes de EXPLAIN ANALYZE del historial (0.17 a 0.77 ms, sin ordenamiento) están en `api-ledger/design.md`.
- **CI.** La simulación del CI en un clon limpio corre las migraciones de ida, de vuelta y de ida otra vez.

**Errores de la AI que detectaron las pruebas:**
- Supuso que `/auth/refresh` devolvía los tokens anidados en `tokens`.
- En tres pruebas adelantó el reloj más que la vigencia del token o del OTP.
- Una prueba de acceso a recursos ajenos (IDOR) usaba una cuenta de la misma usuaria, así que habría fallado por otra razón.
- El EXPLAIN mostró un ordenamiento causado por un hash join. Se corrigió con `JOIN LATERAL`.
- El seed fallaba después de un `db:fund` del mismo día. Lo encontró al probar los comandos del README.
- La simulación del CI expuso una prueba que dependía del orden de los archivos.

**Mutaciones que sobrevivieron** y obligaron a mejorar las pruebas:
- la firma del cursor comparada en bytes;
- la frontera del vencimiento con `<`;
- ciclos del seed con saldo negativo, que los depósitos grandes ocultaban.

**Mutaciones detectadas:**
- quitar los bloqueos;
- invertir el orden de bloqueo, lo que provoca deadlocks;
- quitar `ON CONFLICT`;
- una auditoría que se traga el error;
- usar el día en UTC en lugar de la Ciudad de México;
- quitar `FOR UPDATE` en la transferencia.

**Mismo error de proceso que en la integración.** El subagente usó `git checkout` para revertir una mutación y perdió cambios sin commit de la tarea 7.2. Los rehízo, y desde entonces respalda el archivo antes de cada mutación.

**Huecos del contrato que reportó:**
- `deliveryStatus` es obligatorio en cada lectura, pero no se guarda, así que después de la creación y del reenvío siempre dice `SENT`.
- No hay un 422 declarado para un id mal formado en la ruta. La API responde 404.
- Las extensiones del Problem son opcionales en el esquema, aunque las pruebas exigen que estén.
