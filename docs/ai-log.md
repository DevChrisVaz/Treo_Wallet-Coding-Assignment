# Bitácora de uso de AI

Registro honesto de cómo se usó la AI en esta prueba: qué herramienta, los prompts clave, qué propuso la AI que rechacé y por qué, y dónde tuve que corregirla. Se actualiza en cada sesión de trabajo.

## Herramientas

| Herramienta | Uso |
|---|---|
| **Claude Code** (modelo Claude Opus 5.5) | Exploración del alcance, redacción de las especificaciones, implementación y revisión |
| **OpenSpec 1.8** (schema `spec-driven`) | Modo SPEC: cada parte del sistema es un *change* con `proposal → specs → design → tasks`, que se implementa con `/opsx:apply` y se archiva con `/opsx:archive` |
| **design-sync** (skill de Claude Code) | Lienzos locales del rediseño: cada pantalla como historia sobre los componentes reales, y la comparación de paridad entre web y móvil (sesión 7). La subida a Claude Design queda pendiente |

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

### Prueba de extremo a extremo de la web contra la API real

Pregunté si se había hecho una prueba de humo. La respuesta honesta fue que no: hasta entonces, las pruebas de la web y del móvil usaban APIs simuladas. Pedí despachar un subagente con Haiku para recorrer toda la web.

**Preparación.** La AI principal dejó el entorno listo antes de despachar:
- API construida en el 4000 y web en build de producción en `127.0.0.1:3100`. Primero la arrancó escuchando en todas las interfaces de red y la reinició solo en local.
- Datos de registro comprobados en la base como no usados. Como el registro siempre responde igual, un dato repetido habría parecido un error de la app.

**Resultados.** Dos rondas, de 14 y 7 grupos de pruebas. La AI principal verificó las cifras contra la base de datos antes de reportarlas. Todo pasó:
- transferencias propias y a terceros, doble clic y el reintento tras perder la respuesta, con una sola transferencia y la misma llave;
- umbral del OTP, reenvíos con su tope, vencimiento y agotamiento de intentos;
- límite diario, registro y acceso a datos ajenos;
- Lighthouse 100 en cinco pantallas y la transferencia solo con teclado.

Con esto quedó cerrada la tarea 9.2 de `web-app`.

**Error encontrado y corregido.** Con "Desde" posterior a "Hasta", el historial mostraba "Revisa los campos marcados." sin marcar nada: escribir en un campo de fecha se salta su `min` y `max`, y la API respondía 422. Se agregó el escenario a WEB-14 y la tarea 6.3. La prueba se escribió primero y se vio fallar; dos mutaciones confirmaron que detecta el error. Se comprobó en el navegador.

**Hallazgos que no eran errores:**
- **Errores del brief de la AI principal.** El brief decía que no debía llegar ningún correo al registrarse con un correo existente, pero IDN-01 exige avisar al dueño. También listaba la CURP en minúsculas como inválida, pero la web la convierte a mayúsculas a propósito. El tester lo señaló citando la spec.
- **Una falsa alarma de foco.** El tester reportó que no se veía el foco en "Continuar". La AI principal leyó el color del contorno y le salió blanco, pero era el primer instante de una transición de 150 ms (`transition-colors` también anima `outline-color`). Una segunda lectura y una captura confirmaron el anillo verde de 2 px.

**Error de proceso de la AI.** Un comando encadenado hizo commit aunque fallaron lint y formato, porque esos dos pasos no estaban unidos con `&&`. Las fallas venían de carpetas sin versionar de otra sesión (`.design-sync/`, `.ds-sync/`, `ds-bundle/`), no del cambio, así que el commit era correcto. La lección es la de siempre: no dar por buena una verificación cuyo código de salida no detiene el siguiente paso.

## Sesión 4 — 2026-10-14 · Bonus: estado de cuenta, programadas y biometría

### Elección de los bonus

La AI revisó los bonus del enunciado y propuso cuatro con su costo: estado de cuenta del mes, transferencias programadas, desbloqueo biométrico y un esqueleto de Terraform. Elegí los tres primeros y descarté Terraform. Cognito no lo recomendó.

**Decisiones que tomé sobre la propuesta:**
- **PDF en lugar de CSV.** La AI recomendaba CSV por costo. Con PDF desapareció un riesgo que había señalado (inyección de fórmulas en Excel) y apareció otro conjunto de decisiones: librería, tipografía, paginación y pruebas que leen el PDF.
- **Montos con formato completo** ("$1,250.50"), porque es un documento para personas.
- **Android con huella.** Con eso el desbloqueo se prueba en Expo Go sin un development build; Face ID en iOS lo necesitaría.

**Lo que la AI propuso y quedó en las specs:**
- PDFKit en la API y no Chromium sin interfaz. Un solo generador sirve a la web y, más adelante, a la app.
- Saldo inicial y movimientos leídos de una sola instantánea (`REPEATABLE READ READ ONLY`), para que una transferencia a mitad de la generación no descuadre el documento.
- La descarga del estado de cuenta es la única lectura auditada (`STATEMENT_EXPORTED`), como excepción explícita a AUD-01.
- Las programadas no apartan dinero; saldo y límite se validan al ejecutar, con el límite del día de ejecución.
- Un ejecutor dentro de la API con `FOR UPDATE SKIP LOCKED` que respeta el orden global de bloqueos (contador → transferencia → cuentas), en lugar de EventBridge por transferencia, `pg_cron` o una cola.
- La huella de idempotencia agrega la fecha solo cuando existe, para no cambiar la huella de las transferencias inmediatas ya guardadas.
- Un tope de 20 programadas activas por usuario, para acotar la lista sin paginación.
- El desbloqueo biométrico es una puerta de la interfaz antes de restaurar la sesión. Atar el refresh token a la biometría del Keystore queda como seguimiento documentado.

### Especificaciones

Cuatro changes, todos escritos y validados con `--strict` antes de escribir código: `contract-v1-2`, `account-statements`, `scheduled-transfers` y `biometric-unlock`.

Los changes de la API, la web y el móvil no están archivados, así que sus requisitos no están en `openspec/specs/`. Los nuevos requisitos se agregaron con IDs nuevos que nombran el requisito que amplían, igual que hizo el change `redesign` de otra sesión. La AI revisó los IDs más altos de cada prefijo para no chocar con `redesign` (WEB-31, MOB-22, DSG-17 ya estaban usados).

**Corrección a la AI.** Escribió el `design.md` de `contract-v1-2` en inglés, aunque la regla del proyecto pide artefactos en español. Lo notó al terminar y lo reescribió antes del commit.

### Contrato 1.2.0 y sistema de diseño 1.1.0

La AI principal implementó `contract-v1-2` (5 tareas) y la tarea 1.1 de `scheduled-transfers` (estados y textos en `/design-tokens`). La tarea de `/design-tokens` va antes que cualquier consumidor: si un cliente instala el contrato 1.2.0 sin las etiquetas nuevas, sus mapas exhaustivos de `TransferStatus` dejan de compilar.

**Hallazgos durante la implementación:**
- **La prueba roja de la descarga binaria solo falló en el compilador.** openapi-fetch no valida rutas en tiempo de ejecución, así que las pruebas de CTR-19 pasaban antes de agregar la ruta al contrato; lo que fallaba era `tsc`, porque la ruta no existía en los tipos. Para un contrato, ese es el fallo que importa. También confirmó que el middleware de errores no necesitaba cambios para un PDF.
- **Un formateador creado al importar.** La primera versión de `mexicoCityDate` creaba el `Intl.DateTimeFormat` con la zona horaria al cargar el módulo. Si un motor no tuviera la zona, todo el paquete fallaría al importarse en la app, aunque la app no usa esas funciones. La AI lo cambió para crearlo al primer uso.
- **Una tarea pedía un script que no existe.** La tarea 1.5 decía "`npm run verify` completo", pero el paquete no tiene ese script. Se corrieron los pasos del workflow de CI uno por uno y se corrigió el texto de la tarea en el mismo commit, explicándolo en el mensaje.
- **El lockfile no se actualizó solo con la versión.** La AI subió la versión en `package.json` pero no en `package-lock.json`. Lo detectó al revisar cómo se había hecho la versión 1.1.0 y corrigió su propio commit, que aún no se había publicado.

### Desbloqueo biométrico

Un subagente implementó `biometric-unlock` en su propio worktree: 9 de 10 tareas, con un commit por tarea. La 4.2 es la verificación en mi Android con Expo Go. La sesión del subagente se cortó por el límite de uso a mitad de la tarea 4.1; al retomarla, la AI principal le indicó el estado exacto del worktree y el subagente revisó su diff antes de seguir. Antes de integrar, la AI principal volvió a correr lint, typecheck, formato y Jest (44 suites, 273 pruebas; la línea base tenía 36 y 200), revisó la puerta de desbloqueo y luego hizo el merge `--no-ff`.

**Hechos que el subagente confirmó leyendo el código instalado de `expo-local-authentication`, no solo la documentación:**
- En Android, sin huellas pero con PIN, el diálogo cae al PIN y puede tener éxito. Sin revisar `isEnrolledAsync()` antes de cada diálogo, el escenario "huellas retiradas" de MOB-26 no se cumpliría en un teléfono con PIN.
- Android informa la falta de huellas o de hardware como `not_available`, no como `not_enrolled`.
- `cancelLabel` no aparece en Android cuando se permite la credencial del dispositivo.

**Huecos del spec que encontró y que corregí en el spec:**
- **Etiqueta del botón.** MOB-25 decía "Desbloquear", y el diseño y la tarea decían "Desbloquear con <tipo>". Quedó "Desbloquear con <tipo>".
- **Oferta y el interruptor.** Si la oferta dependía solo de que la preferencia estuviera vacía, apagar el interruptor (que la borra) la volvía a mostrar al instante. El subagente lo descubrió en la tarea 3.2, con dos pruebas que fallaron, y ató la oferta al inicio de sesión con contraseña. El diseño ahora lo dice explícitamente.

**Errores del subagente, corregidos por él mismo:**
- Un ayudante de pruebas esperaba con un temporizador real mientras expo-router usa temporizadores simulados, y dejó `act` abierto: las demás pruebas fallaron en cascada y parecía un error de la app.
- Un `unmount()` sin `await` encimó `act` en cuatro pruebas.
- Un intento de corrección no se aplicó porque iba encadenado detrás de un comando que falló.

**Pruebas en verde desde el principio.** Algunos escenarios negativos ("no pide la huella a los 30 segundos") pasan desde antes de implementar, porque la app aún no hacía nada. Cada uno tiene una prueba positiva hermana que sí falló primero. Además, el subagente comprobó con mutaciones que las pruebas detectan, por ejemplo, decidir el bloqueo en una promesa o remontar la navegación al bloquear.

**Pendiente:**
- **Aviso de `act()` sin verificar.** Aparece en `transfer/__tests__/lost-response.test.tsx`, una prueba que este change no toca, y no se comparó con la línea base.
- **Lo que solo se puede probar en el teléfono:**
  - que la pantalla de privacidad y la de bloqueo se sustituyan sin mostrar saldos entre ambas;
  - el diálogo real de Android;
  - si Android informa el bloqueo por intentos como `lockout`;
  - qué tipo de biometría reporta mi teléfono.

### Estado de cuenta en PDF

Un subagente implementó `account-statements` en su worktree: 12 de 13 tareas. La 3.1 es la verificación en el navegador contra la API real y queda para la AI principal. La sesión del subagente también se cortó por el límite de uso y se retomó con el estado exacto del worktree. Antes de integrar, la AI principal volvió a correr todo:
- API: 110 archivos y 785 pruebas, con PostgreSQL y Mailpit reales.
- Web: 48 archivos y 406 pruebas.
- Lint, typecheck y formato limpios en ambos.

**Medido:**
- **Prueba de rendimiento:** 5,000 movimientos por HTTP en 0.6 s, 162 páginas y 409 KB.
- **Seed real:** con la "Principal" de Ana en septiembre (4,933 movimientos), el documento se genera en alrededor de 1 s.
- **Conciliación:** la consulta del README dio exactamente las cifras del documento, 1,023,976,666 + 156,541,080 − 61,646,290 = 1,118,871,456 centavos.

**Lo que el subagente descubrió y corrigió:**
- **WOFF2 truena en fontkit** al recortar glifos compuestos. Con WOFF el documento tardaba 4.3 s: un perfil de CPU mostró que fontkit descomprime la tabla en cada consulta. Convertir el WOFF a TrueType una sola vez al arrancar lo bajó a 0.8 s, sin versionar archivos TTF. Escribió esa conversión antes de su prueba y lo reconoció en sus notas.
- **El plan de la consulta no coincide con el diseño (D4).** La tanda ascendente no recorre el índice hacia atrás: PostgreSQL usa un Bitmap Index Scan con un `Sort` top-N, unos 4 ms por tanda. Como está acotado al mes, lo dejó y lo documentó.
- **El `down` de la migración del catálogo** recrea la constraint anterior como `NOT VALID`. La bitácora es inmutable, así que una constraint validada haría imposible revertir una vez que existan eventos de estado de cuenta.
- **La prueba de arranque de PLT-08 excedía su tiempo** con la máquina sin memoria. La causa era que la configuración se validaba después de cargar toda la app. Ahora `main.ts` valida antes de importar la composición.
- **Mutaciones que las pruebas detectan:** cambiar la instantánea a `READ COMMITTED` hace fallar la prueba de la transferencia confirmada a mitad de la lectura.

**Hallazgo grave: el contrato 1.2.0 rompió `main`.** El subagente encontró la línea base de la API en rojo antes de tocar nada: 87 pruebas fallando y el typecheck roto. La web y el móvil tampoco compilaban.
- **Causa:** con `file:../contract` e `install-links`, `npm ci` copia lo que haya en la carpeta del contrato, sin importar la versión del lockfile.
- **El diseño se equivocó.** `contract-v1-2` suponía que los consumidores instalarían 1.2.0 cuando quisieran. La AI principal no lo verificó al publicar 1.2.0: corrió solo las pruebas del paquete.
- **Corrección:** el subagente adaptó la API y la web con lo mínimo (campos nulos, códigos en el catálogo y fixtures). La AI principal adaptó el móvil, como tarea 4.1 de `scheduled-transfers`, con un `switch` exhaustivo de códigos y fixtures. Las dos pruebas de MOB-23 pasaron sin cambios, porque las etiquetas ya venían del paquete de diseño 1.1.0; lo que sí falló primero fue el typecheck y una prueba de MOB-14.
- **Lección:** mientras los consumidores usen `file:`, un cambio del contrato que agrega campos obligatorios en respuestas o valores de enums exhaustivos se integra junto con la adaptación de todos los consumidores, no antes.

**Corrección de la AI principal al revisar.** El subagente reportó que Express responde HEAD con el handler de GET: un HEAD generaba el PDF y registraba `STATEMENT_EXPORTED` sin entregar nada. La AI principal escribió primero la prueba, que falló con 200 en lugar de 405, y luego hizo que la ruta responda 405 con `Allow: GET` antes de generar.

**Pendiente para la verificación 3.1.** Antes de abrir la web hay que correr `npm run db:migrate` en la base de desarrollo. Sin esa migración, cada descarga responde 500, porque la auditoría falla, que es justo lo que pide AUD-07.

### Transferencias programadas en la API

Un subagente implementó el grupo 2 de `scheduled-transfers` (14 de 14 tareas) en su worktree. La AI principal volvió a correr la suite completa antes de integrar: 130 archivos y 989 pruebas contra PostgreSQL y Mailpit, con lint, typecheck y formato limpios. También revisó la paginación del ejecutor. El cursor compara la tupla completa `(scheduled_for, created_at, id)` y no solo el id, así que ningún lote salta ni repite programadas.

**Mutaciones que las pruebas detectan,** cada una revertida desde una copia del archivo:
- **Quitar la reverificación `status = 'SCHEDULED'` bajo bloqueo:** en tres de tres corridas, un segundo ejecutor volvió a asentar una transferencia y lo detuvo `uq_ledger_entries_transfer_account`. En la carrera con la cancelación, intentó ejecutar una cancelada.
- **Quitar `SKIP LOCKED`.**
- **Bloquear la transferencia antes que el contador:** lo detecta una prueba dedicada que retiene el contador y comprueba con `NOWAIT` que la transferencia sigue libre.
- **Quitar el bloqueo del usuario en el tope de 20:** dos peticiones simultáneas recibieron 201.
- **Poner siempre la fecha en la huella:** falla contra una huella fijada con el código anterior y verificada aparte en Python.
- **Enviar el aviso de falla dentro de la transacción.**

Dos mutaciones siguieron en verde y el subagente explicó por qué:
- **La reverificación de estado no se ve en las pruebas secuenciales,** porque la consulta de candidatas ya filtra por estado.
- **El orden de bloqueos invertido no produce un deadlock con `SKIP LOCKED`,** solo hace esperar a los demás. Por eso existe la prueba dedicada de `NOWAIT`.

**Desviaciones del diseño, ya registradas en su `design.md`:**
- **Validación de la fecha después de reclamar la llave.** Así, un reintento que llega después de medianoche devuelve la programada y no un `DATE_OUT_OF_RANGE`.
- **Un `down` que se niega si alguna fila tiene `scheduled_for`.** Esto mostró que el plan de reversión del diseño no se podía ejecutar tal como estaba escrito.
- **Paginación por cursor,** para evitar un ciclo infinito si un lote completo falla siempre.
- **Una primera pasada al arrancar** la API.

**Errores del subagente que él mismo encontró:**
- **Una aserción que nunca podía fallar.** Filtraba los logs de error por el nivel numérico de pino (`>= 50`), pero el logger escribe la etiqueta `"error"`. Lo descubrió una tarea después. Tras corregirla, esa aserción es la que detecta la doble ejecución una vez que los errores quedan aislados por transferencia.
- **La prueba de migraciones (PLT-15)** revertía sobre filas que dejó otro archivo. El nuevo `down` protegido se negó, la reversión quedó a medias y tiró los archivos siguientes. La prueba ahora empieza con tablas vacías.

**Riesgo que queda:** con relojes de instancias desfasados unos segundos, confirmar una programada no vuelve a contar el tope, así que podrían quedar 21. Un aviso de falla que no se envía no se reintenta; el outbox queda como seguimiento.

### Transferencias programadas en la web y verificación contra la API real

Un subagente implementó el grupo 3 de `scheduled-transfers` (5 de 5 tareas). Por acuerdo con la sesión del rediseño, los componentes nuevos van en archivos propios, y las ediciones a pantallas existentes quedaron en commits de "cableado" aparte. Así, quien integre segundo puede portarlas sin conflictos. La AI principal volvió a correr la suite (52 archivos y 499 pruebas, con lint, typecheck y formato limpios) antes del merge `--no-ff`.

**Lo que el subagente encontró:**
- **La prueba de doble clic no probaba el candado.** `user.dblClick` de Testing Library envuelve cada clic en `act`, así que React vuelve a renderizar y deshabilita el botón entre los dos clics. La prueba de WEB-17, vigente desde `web-app`, seguía en verde sin el candado `inFlight`. Agregó pruebas con dos clics dentro de un mismo `act`, que sí fallan sin el candado, tanto para "Enviar" como para "Cancelar transferencia".
- **Una fuga en su propio diálogo.** Revisando su trabajo, encontró que el foco salía del diálogo de cancelación con Shift+Tab desde la alerta de error. Escribió la prueba primero y lo corrigió.
- **Mismo error de proceso de siempre.** Corrió una verificación con `| tail`, que oculta el código de salida, y lo notó por la salida.
- **Decisión que protege la idempotencia.** La Server Action valida solo el formato de la fecha, no el rango. La API valida el rango después de reclamar la llave (corrección de D4), así que un reintento después de medianoche sigue devolviendo la transferencia. Una prueba lo fija.

**Verificación manual (con mi autorización para levantar los servidores).** La AI principal aplicó las tres migraciones a la base de desarrollo y levantó la API con el ejecutor cada 5 s y la web en build de producción. Luego recorrió los tres bonus desde el navegador y con curl:
- **Estado de cuenta de septiembre de Ana:** 160 páginas y 4,933 renglones. El resumen es igual al ledger al centavo: 10,239,766.66 + 1,565,410.80 − 616,462.90 = 11,188,714.56.
- **Estado de cuenta de octubre:** sale como parcial y termina en el saldo vigente.
- **Auditoría y límite de descargas:** `STATEMENT_EXPORTED` lleva solo el periodo. La descarga 11 en un minuto recibe 429, y la pantalla muestra la espera.
- **Programar desde la web:**
  - el selector de fecha va de mañana a 90 días;
  - la revisión dice "Se enviará el 20 de octubre de 2026" y el resultado "Transferencia programada";
  - con OTP, el correo trae la fecha;
  - más de 50,000.00 a un tercero regresa al formulario con el error en "Monto".
- **Tope:** la programada 21 recibe `SCHEDULED_LIMIT_REACHED`.
- **Ejecución:** al mover la fecha de una programada a hoy, el ejecutor la completó en menos de 5 s, con dos asientos, auditoría `SYSTEM` y consumo del límite del día.
- **Falla sin saldo:** quedó `FAILED` y el dueño recibió el correo con el motivo.
- **Página "Programadas":** el diálogo funciona solo con teclado. Con el diálogo abierto, el ejecutor ganó la carrera y la cancelación respondió "Esta transferencia ya no se puede cancelar." mientras la lista se recargaba.
- **Al final,** las consultas de conciliación del ledger siguieron en cero.

Con esto, `contract-v1-2`, `account-statements` y `scheduled-transfers` quedan completos. A `biometric-unlock` le falta solo la verificación en mi Android.

## Sesión 5 — 2026-10-14 · Cobertura de las reglas de dominio

### Auditoría de cobertura

Pedí revisar si todas las reglas de dominio tenían pruebas. La AI lanzó siete subagentes de revisión (uno por capability) que cruzaron cada escenario de las specs con las pruebas que lo ejecutan, y midió la cobertura de líneas y ramas con `@vitest/coverage-v8` instalado sin guardarlo en `package.json`. Antes de reportar, la AI comprobó a mano cinco de los hallazgos.

**Resultado:** de 216 escenarios de dominio (IDN, ACC, BEN, TRF, HIS, AUD), 207 tenían una prueba que ejecuta el WHEN y comprueba cada THEN, 8 estaban cubiertos en parte y 1 no tenía prueba (TRF-03, reintento con la misma llave después de confirmar el OTP). Además había reglas que el código aplica y ninguna prueba ejercía: el límite diario en el camino con OTP, la llave de idempotencia por usuario, la reversión ante fallas de auditoría en varios caminos, decenas de constraints de la base y el siglo de la CURP.

### Cierre de las brechas

Pedí cerrar todo con subagentes. La AI escribió y validó el change `domain-test-coverage` (solo pruebas, `skip_specs`) y lo commiteó antes del código. Sus decisiones: cada prueba escrita después del código se demuestra rompiendo la regla y viéndola fallar (D1); cada línea de trabajo usa su propio PostgreSQL y Mailpit en contenedores temporales, porque las pruebas de integración reinician la base y vacían la bandeja (D2); las constraints se disparan con SQL directo (D3); un defecto descubierto se reporta y no se corrige ahí (D4).

**Correcciones a la AI:**

- **Modelo de los subagentes.** Lanzó los siete subagentes sin indicar modelo, así que heredaron Opus. Le pregunté qué modelos corrían y le dije que el costo importa. Los detuvo (todavía instalaban dependencias, no se perdió ningún commit) y los relanzó en Sonnet. Guardó la preferencia para las siguientes sesiones.
- **Un `.env` cargado con el shell.** Intentó leer `api/.env` con `set -a; . ./.env` en zsh; falló en `SMTP_FROM` (lleva `<`) y el bucle que esperaba los contenedores quedó girando cinco minutos sin que existieran. Lo detuvo y leyó solo las dos contraseñas que necesitaba.
- **Pausa a mitad del trabajo.** Pedí pausar; la AI detuvo las seis líneas que seguían y reportó en qué estado quedó cada una, incluidas dos mutaciones activas (un archivo de producción modificado en la línea 2 y constraints borradas en la base de la línea 6). Al reanudar, cada línea restauró lo suyo antes de seguir.

**Incidentes de los subagentes:**

- **`pkill -f vitest`.** Un subagente lo corrió para cortar una prueba colgada; podía matar corridas de las otras líneas y de la sesión del rediseño. Lo dijo en su reporte y la AI avisó a las demás. Ninguna corrida se perdió.
- **Atribución.** Las reglas comunes que escribió la AI pedían el trailer `Co-Authored-By: Claude Opus 5.5`, aunque los subagentes eran Sonnet. Las líneas 7 y 4 lo siguieron (39512bb, 0dcce09, 2f4ff67, befd9dd, c08db61, b347718, ceff508, 61d5af0); las líneas 1, 2, 3, 5 y 6 pusieron `Claude Sonnet 5.5`, que es lo correcto. No se reescribió la historia porque esos commits ya quedaron debajo del merge del rediseño; todas las pruebas de este change las escribió Sonnet.

**Lo que encontraron las pruebas (ningún defecto de comportamiento):**

- **Una prueba que no podía fallar:** la barrera de la carrera del tope de programadas se rendía en silencio. Ahora usa el helper que lanza un error, y retrasar la segunda petición la hace fallar.
- **Mutaciones que una prueba no detectaba:** el primer escenario del avance del lote del ejecutor no detectaba el cursor roto (las fallidas salen de la cola), así que se agregó un segundo caso que sí lo detecta. En BEN-07, la prueba de integración no falla con la mutación porque el índice único lo impide antes; la prueba unitaria sí falla.
- **Código inalcanzable o redundante:** el recorte a cero del límite restante no se puede alcanzar porque la base prohíbe usar más que el límite; la revisión de vencimiento de la familia en `refresh-session.ts:56` nunca decide porque cada token ya vence con su familia; `logout.ts` dice que un token vencido "no cambia nada", pero lo revoca y lo audita (la respuesta sigue siendo 204).
- **Diferencias entre el contrato y el paquete,** reportadas sin fijarlas en pruebas: `FullName` de `openapi.yaml` acepta `"   "` y el paquete la rechaza; `z.uuid()` exige versión y variante y `format: uuid` no.
- **Una prueba inestable corregida:** el plan de HIS-09 a veces traía un Sort; se agregó `ANALYZE` después del seed.

**Resultado:** los 216 escenarios de dominio tienen ahora una prueba que ejecuta el WHEN y comprueba cada THEN, según los reportes de cada línea (la auditoría independiente no se repitió). La AI revisó cada rama, la integró a `release` con `--no-ff` y volvió a correr todo sobre el resultado:

- **`/api`:** de 130 archivos y 989 pruebas a 136 y 1183; líneas de 96.5 % a 96.9 % y ramas de 86.7 % a 87.9 % (capa de aplicación: 90.6 % a 93.0 %). Lint, typecheck y formato limpios.
- **`/contract`:** de 302 a 334 pruebas; líneas de 96.8 % a 98.2 % y ramas de 84.0 % a 91.1 %.
- **Sin cambios en código de producción** (`api/src`, migraciones, `contract/src` y `openapi.yaml` siguen iguales).

**Lo que queda fuera de este change:** la máquina de estados de transferencias no se usa en producción, `deliveryStatus` no se guarda, no hay herramienta para detectar cambios incompatibles del contrato (CTR-02), `passWithNoTests` sigue activo en `/api`, la redacción de logs llega solo a cuatro niveles, y la traducción de la violación de unicidad de beneficiarios a `BENEFICIARY_CONFLICT` en el store solo la alcanza a veces una prueba de carrera.

## Sesión 6 — 2026-10-14 · Entrega: propuesta de AWS, trazabilidad y cierre de la bitácora

**Quién:** esta sesión la ejecutó un subagente (Claude Haiku 5.5, según el trailer de sus commits) con el change `delivery` y una lista cerrada de tareas. No grabó el video, no creó la rama `main` ni cambió los disparadores de los workflows, y no revisó con el usuario las decisiones D1 a D12 (tarea 1.1).

**Qué se hizo:**
- **`docs/aws-deploy.md`:** diagrama en Mermaid, las seis filas de la tabla de la Fase 4 y las tres preguntas por escrito. Parte de `design.md` de `delivery` y lo contrasta con el repositorio: el documento dice de forma explícita qué **no** existe hoy (Dockerfiles, colector de OpenTelemetry, sesiones y rate limiting en Redis, `lock_timeout`) y que el pool de la API es de 20 conexiones.
- **`scripts/trace.sh`:** Bash con `git`, `find`, `grep` y `awk`. Genera la matriz requisito → change → tareas → commits → pruebas y la lista de huecos; con `--check` termina con error si hay alguno.
- **README:** Mapa de la especificación (HU1 a HU6 y bonus) y enlaces a los `design.md` de cada change.

**Hallazgos de esta sesión:**
- **Los trailers no se leían.** El primer commit puso las líneas `Task:` en un párrafo separado del `Co-Authored-By:`. Git solo reconoce como trailers el último párrafo, así que `trace.sh` no habría visto ninguna tarea. Se detectó al leer los trailers con `git log --format='%(trailers)'` y se corrigió ese commit antes de seguir (aún no estaba compartido).
- **El script encontró huecos reales, no un error suyo.** Cuatro requisitos (CTR-01, CTR-03, CTR-17 y PLT-17) no tienen ninguna prueba cuyo título empiece con su ID. Se comprobó con `grep` que no existe ninguna: se verifican con pasos del CI (lint del contrato, tipos al día, los propios workflows). Se documentaron en `docs/traceability.md` en lugar de forzar una cobertura con pruebas que solo comprobarían que un archivo existe.
- **La tarea 2.4 no mencionaba `design-tokens/`.** Los requisitos DSG se prueban ahí, así que el script también busca en esa carpeta; sin ella, todos los DSG habrían salido como huecos falsos.
- **Arranque desde un clon limpio (tarea 5.2).** Se clonó el repositorio y se siguieron los pasos del README: `npm ci` y build de `contract` y `design-tokens`, `npm ci` de la API, la web y la app, `docker compose up`, `db:bootstrap`, `db:migrate`, `db:seed` (120,128 asientos en 17.8 s), la API, `/health`, Swagger UI en `/docs` y el contrato en `/openapi.yaml`, el inicio de sesión de Ana por HTTP, la web en `/login` y `npx expo export --platform android`. Todo funcionó y el README no necesitó cambios. Límites de la prueba: se usaron puertos alternos (55433, 51025, 58025, 4010 y 3010) y un proyecto de compose distinto, porque los puertos habituales ya estaban ocupados por el entorno de desarrollo del usuario; no se recorrió la web con el navegador ni la app en un teléfono. Un hallazgo: `db:bootstrap` sin `psql` instalado usa `docker compose exec` en la carpeta de la API y, con el proyecto de compose por defecto, **ejecutó los roles contra el contenedor ya existente del usuario** antes de que se fijara `COMPOSE_PROJECT_NAME`. Fue inocuo (idempotente y con las mismas contraseñas de desarrollo), pero la herramienta no distingue entre dos entornos con el mismo nombre de proyecto.
- **El diagrama de Mermaid no se renderizó.** El repositorio no incluye ninguna herramienta para validarlo; se revisó la sintaxis a mano (etiquetas con acentos y puntos entre comillas, sin palabras reservadas como identificadores). Falta abrirlo en GitHub para confirmarlo.

## Sesión 7 — 2026-10-14 · Rediseño (`redesign`)

Esta sesión corrió en paralelo con las sesiones 4 a 6, en sus propios worktrees, y se integró a `release` al final. Por eso su entrada va después del cierre de la sesión 6, como anticipaba el resumen de abajo.

### Prompts clave

Textuales, en inglés, como los escribí:

- "I approve the design so when you're done with phase a, proceed with phase b and apply the new styles to the projects. I'll go to bed, I'll review results in the morning. Good luck!" (la aprobación visual de la tarea 5.4, después de revisar los lienzos)
- "Before the merge, some changes where made and some new features where added, can you apply the new styles to them? I want to see them in the canvas. Work in a worktree once the work in progress is done" (para los bonus que llegaron de otras sesiones)
- "Can we merge the previous work while this is still in progress?" (el primer merge anticipado)
- "Also restart the servers so I can see the changes" y, después, "kill 8081"
- "Apply them the code and merge" (aplicar las notas de la revisión de P2 e integrar)

El prompt con el que empezó el rediseño no quedó registrado textualmente. La bitácora de la sesión sí guardó tres instrucciones que guiaron las decisiones: trabajar "en paralelo donde se pueda", que la web en un teléfono se viera exactamente como la app y "mismo aspecto, funciones propias" para lo que solo existe en una plataforma.

### Proceso

- **Especificación primero.** El change `redesign` (decisiones D1 a D10; requisitos DSG-13 a DSG-17, WEB-24 a WEB-31 y MOB-18 a MOB-22) se escribió y se validó con `--strict` antes del código.
- **Fase A, el prototipo.** En una rama aparte (`design/redesign`): tokens v2 aditivos, los kits de web y móvil reestilizados con sus componentes nuevos, y todas las pantallas como historias en los lienzos locales de design-sync (la web a 1280 y a 390 px; la app con react-native-web a 390×844). Un lienzo de paridad pone cada pareja lado a lado, con superposición al 50 %, y `parity-check.mjs` mide la proporción de píxeles distintos. Las pantallas reales no se tocaron.
- **Dos líneas en paralelo.** En cada fase hubo una línea web y una móvil, cada una en su worktree y con sus instalaciones, con un implementador por tarea y un revisor después de cada una. Se integraban con `--no-ff`. La skill de desarrollo con subagentes pide un implementador a la vez; mandó mi instrucción de trabajar en paralelo.
- **Aprobación.** Revisé los lienzos y aprobé con el mensaje de arriba. Los valores que se cerraron en el prototipo quedaron en `design.md`.
- **Fase B, la aplicación,** mientras yo dormía. La AI escribió el plan y una revisión previa encontró 8 bloqueos, 6 problemas importantes y 17 menores, que se aplicaron al plan antes de empezar. Después lo ejecutó en dos líneas: web (6.1 a 6.7) y móvil (7.1 a 7.5).
- **Paridad sobre las pantallas reales (8.1).** La web real corrió con `next dev` contra una API simulada con los datos de las historias, y Playwright la recorrió como una persona. La app no puede correr completa en el navegador, así que el lienzo dibuja sus vistas reales. Se comparó cada pantalla con su historia aprobada y cada pareja web↔móvil.
- **Los bonus de otras sesiones.** Mientras tanto, otra sesión integró los bonus a la rama principal. El rediseño la trajo dos veces a mitad del trabajo (P0 y P0b) para no chocar al final, y portó la web de las programadas al flujo nuevo (P1). A petición mía, después estilizó con el kit todos los bonus y les hizo historias en los lienzos (P2).
- **Dos merges anticipados, locales y sin push.** Pedí integrar antes de terminar. El primero (`b3bb8ae`) llevó las fases A y B, la paridad y P1; el segundo (`e3e5554`), P2. Antes de cada uno se corrieron todas las verificaciones; la documentación (8.2) y la resincronización de los lienzos (8.3) quedaron para después.

### Propuestas de la AI que acepté o modifiqué

| Tema | Decisión |
| ---- | -------- |
| Tarjeta de cuenta seleccionable | El plan envolvía el título y el saldo en un `<button>`: HTML inválido y sin encabezado. El botón va dentro del `h3`, solo con el nombre, y el saldo afuera. Después, toda la tarjeta selecciona con el pseudo-elemento del botón, y "Mostrar CLABE" queda encima con su propia área de 44 px, sin que las áreas se encimen |
| Encabezados | En teléfono el saludo era un párrafo y el flujo en escritorio tenía dos `h1`. Quedó un solo `h1` por página en todos los anchos |
| Monto protagonista | El "$" flotaba a unos 100 px de los dígitos. El primer arreglo medía el campo en `ch`, que lo hacía demasiado ancho porque los dígitos de Work Sans son proporcionales. Ahora un espejo oculto mide el texto, en web y en móvil |
| "Mostrar CLABE" en Inicio de la web | Lo conservé aunque la app no lo tiene: mismo aspecto, funciones propias |
| Tamaño del Wordmark | La AI lo agrandó para todos, también en pantallas que la fase A no debía cambiar. Quedó el tamaño anterior, y el grande solo en las pantallas de marca |
| Indicador de pasos | El total pasa de 5 a 4 cuando el monto no pide código. Se queda: es lo que aprobé |
| Cuentas propias como destinatario | El plan ofrecía las propias menos el origen por defecto, así que Ahorro → Principal solo se podía desde Inicio. Ahora están todas, y el paso del monto no ofrece como origen la que se eligió |
| Pantallas móviles | Cada una se partió en contenedor y vista pura, con una prueba que lo vigila, para que el lienzo dibuje el código real |
| Especificación contra historias | Donde el texto y las historias aprobadas diferían, mandaron las historias: "Agregar beneficiario" en la barra superior, el registro sin pie fijo y los filtros de escritorio en un panel centrado |
| Bonus en el rediseño | El estado de cuenta, en su propia tarjeta después del historial. "Programadas", en la navegación lateral y, en teléfono, desde el paso del destinatario, porque la barra conserva las pestañas de la app. "Programadas" lleva un icono propio (CalendarClock), que subió el paquete de diseño a 1.3.0. El desbloqueo biométrico, intacto, con su interruptor en el menú de la cuenta |

### Errores de la AI que detectaron las pruebas y las revisiones

**En la fase A:**

- **Una expresión regular que rechazaba el icono `X` de Lucide** (pedía dos caracteres o más).
- **Formato sin revisar:** las tareas 2.1 a 2.3 dejaron nueve archivos de `/design-tokens` sin formatear, y el CI los habría rechazado. Desde entonces, cada tarea corre `format:check` antes del commit.
- **Las previews de design-sync rompían Prettier en el CI** desde que se versionaron. Esas carpetas se excluyeron de Prettier y ESLint, porque reformatearlas habría invalidado todas las revisiones visuales.
- **Reglas de `.gitignore` ancladas a la raíz** que nunca coincidían dentro de `web/` ni de `mobile/`.
- **React Native 0.86 ya no tiene `StyleSheet.absoluteFillObject`.**
- **Accesibilidad:** el anillo de foco verde no se veía sobre el *hero* verde (ahora es lima); el botón del avatar medía 40 px (ahora 44); las hojas inferiores perdieron el alto máximo y el desplazamiento, así que las listas largas se cortaban.
- **La revisión final de la fase A** encontró que `MovementRow` cambiaba de formato sin que nadie lo pidiera y rompía las listas planas vigentes, que la etiqueta accesible del movimiento móvil perdía la referencia, y que `dates.ts` creaba los formateadores de zona horaria al importar, sin respaldo, y tomaba los meses del ICU del motor ("sep" en un motor, "sept" en otro). También quedaban 98 avisos de react-native-web en los lienzos; quedaron en cero.

**En la fase B:**

- **Foco perdido (WEB-23):** al confirmar el código en el detalle de una transferencia, el foco se perdía porque el comprobante no tenía encabezado.
- **Playwright podía usar la API real.** Con `reuseExistingServer: true` adoptaba cualquier servidor que ya escuchara en el puerto. Ahora siempre levanta los suyos.
- **Texto al 200 %:** los saldos se partían entre dígitos y la pestaña "Beneficiarios" quedaba fuera de la pantalla (WCAG 1.4.4). A 320 px, el tipo del movimiento se encimaba con el monto.
- **Bloquear el desplazamiento al abrir una hoja** quitaba la barra clásica y la página se movía su ancho.
- **Movimientos en el móvil:** si fallaba `GET /accounts`, la pantalla se quedaba en esqueletos para siempre, y deslizar para actualizar pedía `/accounts//movements`, porque `refetch` de TanStack Query 5 ignora `enabled`.
- **El comprobante móvil de una fallida** fijaba el estado `FAILED` en lugar de leer el de la API, y un error al recargar en segundo plano reemplazaba el comprobante por el error.
- **La prueba de vistas puras pasaba sin revisar nada** si no encontraba archivos.
- **La paridad sobre pantallas reales (8.1)** encontró cuatro diferencias de estructura con las historias aprobadas, corregidas con su prueba: el paso del monto móvil separaba sus campos 16 px en lugar de 20; el detalle de la web mostraba un título que la historia no tiene; el paso del código separaba sus bloques 16 px en lugar de 20; y lo último de la página quedaba a 23 px de la barra de pestañas y a 47 px del pie fijo, en lugar de 20. También encontró que Google Fonts entrega otra compilación de Work Sans a cada navegador, con otros anchos de letra: el lienzo y `next/font` no usaban el mismo archivo.
- **En los bonus:** "Programadas" repetía el icono de "Transferir", el diálogo de cancelar no cabía a 320 px con el texto al 200 %, y el resultado programado se anunciaba dos veces.

**Contradicciones del plan que se resolvieron sin debilitar pruebas:** el plan decía que las pruebas del desbloqueo quedaban sin cambios, pero la navegación nueva obligaba a abrir el menú de la cuenta antes de tocar el interruptor; se reubicaron los pasos y ninguna aserción se debilitó.

### Incidentes de proceso

- **El límite de uso detuvo a los subagentes cuatro veces,** tres de ellas a mitad de una tarea. Se reanudaron con su contexto y revisaron su trabajo sin commit antes de seguir.
- **Una corrección se escribió antes que su prueba** (la ronda de la tarea 4.5): la prueba existe y pasa, pero no se vio fallar. Un reporte (7.4) llegó sin la evidencia de rojo y verde.
- **La rama principal cambió debajo del rediseño.** A petición mía, otra sesión renombró `main` a `release`, y después una tercera sesión reescribió su historia. El merge de P2 con la versión vieja habría resucitado un archivo que esa reescritura quitó (`docs/video-script.md`); se rehízo sobre la `release` nueva.
- **Un `pkill -f vitest` de otra sesión** mató corridas en toda la máquina; se repitieron.

### Verificación

- **Pruebas:** al cerrar la fase A, 266 en `/design-tokens`, 469 en la web y 260 en el móvil. Al integrar el segundo merge: 274 en `/design-tokens`, 731 de Vitest y 50 de Playwright en la web y 395 de Jest en el móvil, con lint, typecheck y formato limpios. Antes de cada merge también pasaron el contrato (334) y las unitarias de la API (520 y 523).
- **Navegador real** (`npm run test:e2e`): sin desplazamiento horizontal de 320 a 1920 px, un solo `h1` visible, la transferencia solo con teclado, las hojas y axe con el CSS real.
- **Paridad:** las 15 parejas del prototipo salieron idénticas, con diferencias de suavizado o con diferencias por diseño acordadas. En 8.1, con el mismo archivo de fuente, la web real dio 0.0000 contra sus historias fuera de las zonas acordadas, la vista móvil real dio 0.0000 contra la suya, y cada pareja repitió la medición del prototipo. Las tablas están en `web/.design-sync/NOTES.md`.

### Resincronización de los lienzos (8.3)

- **La fuente, fija.** La web servía Work Sans con `next/font/google` y el lienzo la pedía a Google Fonts, que entrega otra compilación a cada navegador. Ahora las dos usan el mismo archivo versionado (`web/app/fonts/WorkSans-latin.woff2`, OFL) con `next/font/local`, y una prueba lo comprueba. El archivo es el que recibía el lienzo, así que las historias aprobadas no cambiaron un píxel (116 capturas iguales) y la pantalla real pasó a coincidir con ellas: en la corrida normal, A y B dan 0.0000 fuera de las zonas acordadas, donde 8.1 nunca bajaba de ~0.002.
- **Lo que quedaba desfasado:** las notas y convenciones de los lienzos todavía describían `PageShell` y las historias anteriores al rediseño; las previews de componentes de antes del rediseño se rehicieron sobre el lienzo de la app y con las props de la fase B; las historias usan el `StepActions` del kit, así que su final de página mide lo mismo que la pantalla real.
- **Lo que encontró la revisión de las capturas:** en el lienzo, el fondo neutro de las insignias "Vencida" y "Cancelada" es del mismo color que el lienzo y la píldora no se veía; el saldo del *hero* se cortaba en teléfonos de 300 px de la historia de privacidad; y el pie fijo de `StepActions` quedaba fuera de la captura de 700 px. Se corrigieron las historias, no los componentes.
- **El servidor de revisión** que servía los lienzos se cayó varias veces durante la sesión; esta tarea usó su propio servidor en otro puerto y solo detuvo los procesos que arrancó.

### Pendiente

- **Subir los lienzos a Claude Design:** requiere `/design-login`, que no se ha hecho en este entorno; después, `resync` desde cada app.
- **La lista de Expo Go del rediseño** (`mobile/README.md`): fechas en Hermes, texto agrandado, foco de las hojas, atrás de Android, área segura y el anuncio del paso.

## Sesión 8 — 2026-10-14 · Infraestructura en Terraform

**Prompt clave:** "Now I want you to build the terraform configuration in a new infrastructure folder".

**Quién:** Claude Code con Claude Opus 5.5, sin subagentes. No se creó un change de OpenSpec para este trabajo: la configuración `openspec/config.yaml` no tiene etiqueta ni prefijo de requisitos para infraestructura.

**Qué se hizo:** [`infrastructure/`](../infrastructure/README.md) traduce [`docs/aws-deploy.md`](aws-deploy.md) a Terraform: `bootstrap/` (estado y roles OIDC por cuenta), un módulo raíz `stack/` para los tres ambientes, catorce módulos y un archivo de variables y un backend por ambiente. Se agregó el workflow `infrastructure` (formato, `validate` y `terraform test`). Nada se aplicó en una cuenta de AWS.

**Decisiones de la AI, pendientes de revisar:**

| Tema | Decisión |
|---|---|
| ALB | Interno, con CloudFront por *VPC origin*. El documento lo ponía en subredes públicas; se actualizó el documento y su diagrama |
| Secretos | Contraseñas efímeras en argumentos de solo escritura, para que no queden en el estado. Excepción: la credencial SMTP de SES |
| Despliegue | Dos `apply` por versión: primero la imagen de la tarea de migraciones, después la de los servicios |
| Redis | Se crea aunque ninguna aplicación lo usa todavía; mientras tanto, afinidad por cookie hacia el BFF |
| Rol de apply en GitHub | `AdministratorAccess`, protegido por la condición de ambiente; la política de mínimo privilegio queda pendiente |

**Hallazgos de esta sesión:**
- **Un ciclo de dependencias.** El secreto de `wallet_app` lo lee RDS Proxy, y su contenido lleva el endpoint del proxy. `terraform validate` lo detectó y se separaron los secretos de sus versiones.
- **La validación de ACM no habría planeado.** Las llaves de su `for_each` salían de un atributo que ACM calcula. Lo encontró la prueba del stack con proveedores simulados, no `validate`; ahora las llaves salen de los nombres configurados.
- **Los proveedores simulados no admiten recursos efímeros.** Las pruebas usan el proveedor `random` real, que no necesita credenciales.
- **Se comprobaron dos supuestos en la fuente original** antes de documentarlos: en el código del proveedor, que con `secret_string_wo` el valor del secreto no se lee de vuelta al estado; en la guía de CloudFront, que la lista de prefijos de CloudFront sirve para los VPC origins. La guía mostró además que los VPC origins no funcionan en algunas zonas (`use1-az3` en us-east-1), y el módulo de red las excluye.
- **Las pruebas se probaron a sí mismas.** Al dar a la API el secreto de `wallet_migrator`, la prueba de separación de credenciales falló, como se esperaba.

## Sesión 9 — 2026-10-14 · Sesiones de la web en Redis

**Quién:** Claude Code (Claude Opus 5.5) conmigo, en la sesión principal, mientras otras cuatro sesiones trabajaban en la misma copia del repositorio. Por eso el change se hizo en un worktree propio (`dev/web-redis-sessions`, desde `release`).

**Prompt clave:** "Mi sesión en el navegador se cerró, ¿por qué? ¿No funcionó el refresh token?" y, después de la explicación, "Configura Redis también para desarrollo y agrégalo a los servicios de Docker".

**El diagnóstico, con evidencia y no con una suposición.** Antes de proponer nada, la AI cruzó la tabla `app.refresh_tokens` y `app.audit_log` con los procesos del sistema. La sesión de las 16:16 tenía un refresh token **nunca usado ni revocado**; a las 16:23 otra sesión de trabajo había hecho `next build` y levantado de nuevo `next start`. El `Map` de sesiones murió con el proceso anterior: la cookie seguía apuntando a un id que el proceso nuevo no conocía. El refresh token no falló; nunca llegó a usarse. No había ningún `REUSE_DETECTED` en el día.

**Decisiones (`openspec/changes/web-redis-sessions`):**
- **Dónde va Redis:** la AI preguntó en lugar de suponer, porque mi pedido ("los servicios de Docker") apuntaba al `docker-compose.yml` de `/api`, pero eso rompe la regla de proyectos independientes. Elegí un `docker-compose.yml` propio de `/web`.
- **`REDIS_URL` opcional:** sin ella sigue el `Map`, así que las pruebas unitarias, el build del CI y el e2e con la API simulada no necesitan Docker.
- **`touch` atómico en Lua.** La AI señaló el riesgo antes de escribir código: un `touch` que lee y reescribe la sesión completa podría devolverle un refresh token ya rotado por una renovación concurrente; la siguiente renovación sería reuso y la API revocaría la familia. Con un hash por sesión, `touch` solo cambia `lastSeenAt` y el TTL, y no revive una sesión cerrada.
- **Fallar rápido.** La AI probó node-redis 5.12 antes de diseñar la conexión: con la estrategia por defecto, `connect()` queda pendiente para siempre si Redis no está, y las páginas se habrían quedado colgadas. La conexión se rinde tras dos reintentos al arrancar, `disableOfflineQueue` hace fallar los comandos sin conexión, y no se cae al `Map` en silencio.

**Cómo se comprobó:**
- **Mutaciones:** un `touch` que reescribe la sesión hace fallar las dos pruebas concurrentes (con `set` y con `delete`). Un `HSET` + `PEXPIRE` sin comprobar la llave sobrevivió a las primeras pruebas; se agregaron dos (`touch` tras cerrar la sesión y TTL tope en la vigencia absoluta) y se vio fallar el mutante antes de restaurar el archivo desde una copia.
- **La misma suite en las dos implementaciones:** el comportamiento de WEB-03 pasó a `test/support/session-store-contract.ts`; memoria con reloj falso y Redis con tiempo real.
- **A mano contra la API real:** inicio de sesión de Ana en un build de la rama con `REDIS_URL`, reinicio del proceso de Next.js y la pantalla de cuentas siguió cargando; luego, con el access token marcado como vencido en Redis, la siguiente carga rotó el par por la API (token usado, sucesor emitido, sin revocación) y lo guardó de vuelta.

**Corrección a la AI:** la suite completa falló de forma intermitente en una prueba de Redis que pasaba sola. La AI no la reintentó ni subió los márgenes de tiempo: grabó los comandos con `redis-cli MONITOR` y encontró la causa. Los dos archivos de pruebas de Redis hacían `FLUSHDB` en `beforeEach` y, al correr en paralelo, uno borraba la sesión que el otro esperaba. Cada archivo borra ahora solo sus llaves; tres corridas completas pasaron.

**Al integrar, un ID repetido.** Mientras esta rama estaba abierta, `ux-fixes` llegó a `release` con su propio WEB-35 ("Recibir dinero") y WEB-36. El ID se había elegido libre en la base de la rama, pero `ux-fixes` vivía en cambios sin commit de otra sesión. Los IDs no se reutilizan, así que este requisito pasó a **WEB-37**. Los trailers `Refs:` de los commits decían WEB-35 y `trace.sh` los habría acreditado a "Recibir dinero". Por eso la rama se rehízo en `dev/web-redis-sessions-v2`, con el ID corregido en el contenido y en los mensajes, y se comprobó que la única diferencia con la original es el ID. Reescribir la rama en el lugar (`filter-branch`) lo bloqueó el modo automático; la rama original quedó intacta.

**Pendiente:** el *single-flight* de la renovación sigue siendo por proceso (aceptado en D2 de `web-app`), y el rate limiting de la API sigue en memoria.

## Sesión 10 — 2026-10-14 · Se revierte D14 de `ux-fixes`

**Prompt clave:** "undo d14", tras una revisión automática de seguridad que marcó la enumeración de datos de identidad en el registro.

**Quién:** Claude Code con Claude Opus 5.5, en una rama aparte (`dev/undo-d14`) mientras otra sesión terminaba `registration-birth-data` sobre los mismos archivos del registro; se coordinaron por mensajes y la rama se rebasó dos veces sobre sus commits.

**Qué se hizo:** el registro vuelve a la respuesta uniforme de IDN-01 e IDN-03 de `api-foundation`: `202` en todos los casos y el aviso "No pudimos completar tu registro" cuando la CURP, el RFC o el teléfono ya son de otra cuenta. `ALREADY_REGISTERED` sale del contrato (en la 1.4.0, sin publicar), de la API y de la web. D14 queda en `design.md` como decisión revertida, con las tareas 2.7 a 2.9.

**Hallazgos de esta sesión:**
- **Revertir no cierra la enumeración.** La segunda revisión de seguridad lo señaló: quien controla el correo recibe el aviso en lugar de un código, así que sabe que el dato ya tiene cuenta. La AI había descrito la reversión como "avisar al dueño de la cuenta"; el código original avisa al correo que se escribe en el formulario. Se corrigió la descripción y se le planteó al usuario cómo seguir: mitigaciones (avisar al dueño real, límite por dato) o registro en revisión.
- **La rama no compilaba por un trabajo a medias de otra sesión.** El contrato 1.4.0 ya estaba en `release` sin el código de la API y de la web que lo usa. Antes de culpar a la reversión, se comprobó que las pruebas que fallaban eran las de esos campos y se esperó a que la otra sesión terminara.
- **Pruebas sin tocar el entorno del usuario.** PostgreSQL y Mailpit corrieron en un proyecto de compose propio (`treo-undo-d14`) con otros puertos, y `db:bootstrap` con `COMPOSE_PROJECT_NAME` fijado: el hallazgo de la sesión 6.

## Sesión 11 — 2026-10-14 · Registros en revisión (`registration-review`)

**Prompt clave:** "option 3", y entre sus dos variantes, "Review only for conflicts".

**Quién:** Claude Code con Claude Opus 5.5, en una rama aparte (`dev/registration-review`), avisando a la otra sesión activa antes de tocar los archivos del registro.

**Corrección de la AI antes de empezar:** al ofrecer la opción 3 la había descrito como "la única que no revela nada". Eso solo es cierto si todos los registros pasan por revisión; si los demás abren sus cuentas al verificar, quien probó con datos ajenos nota la diferencia. Se le planteó al usuario la elección entre revisión para todos o solo para los choques, y eligió la segunda, sabiendo lo que queda.

**Qué se hizo:** el change `registration-review` (propuesta, diseño D1 a D7, deltas de IDN-03, IDN-06, IDN-08, AUD-01, DSG-12, WEB-11 y WEB-12, y los nuevos IDN-16 y MOB-30). Un registro con datos de otra cuenta responde el mismo `202` y recibe el mismo correo con código; al verificar queda en revisión (`403 REGISTRATION_IN_REVIEW`, sin cuentas ni sesión), se audita con los datos que chocaron y el dueño de esos datos recibe un aviso. Contrato 1.5.0, paquete de diseño 1.4.0, migración con índices únicos parciales, web y app.

**Hallazgos de esta sesión:**
- **Un paquete nuevo rompe a sus consumidores en el orden equivocado.** La web y la app comprueban al compilar que el paquete de diseño tiene un mensaje por cada código del contrato. Reinstalar el contrato 1.5.0 antes que el paquete de diseño 1.4.0 las habría dejado sin compilar, así que cada consumidor reinstala los dos en su primera tarea y cada commit queda en verde.
- **`npm install` no actualiza la versión de un paquete `file:` en el lockfile.** Instaló 1.5.0 pero dejó 1.4.0 registrado; se corrigió a mano, como en el cambio a 1.4.0, y `npm ci` confirmó que el lockfile es coherente. El de la app todavía registraba 1.3.0.
- **La unicidad por nombre se conserva.** Los índices únicos parciales llevan los nombres de las constraints que reemplazan, así que la traducción de errores de PostgreSQL y las pruebas de esquema no cambian. La prueba de ida y vuelta de las migraciones ejercitó el `down`.

## Sesión 12 — 2026-10-15 · Endurecimiento de seguridad (`security-hardening`)

**Prompt clave:** "Dame un resumen de todas las decisiones de seguridad que se implementaron y las que no", y sobre la lista de huecos que devolvió la AI: "realiza del 4 el punto 1, 2, 4 y 11, el resto también agrégalas al readme. Los cambios los quiero en una rama separada y que un subagente los realice, tú lo orquestas y revisas el resultado". Al final: "lanza a haiku a probar todo el panel web".

**Quién:** Claude Code con Claude Opus 5.5 como orquestador y revisor. Implementó un subagente con Sonnet en `dev/security-hardening`, con su propio worktree, PostgreSQL (5443) y Mailpit (1035 y 8035). La prueba de punta a punta la hizo un agente con Haiku contra una compilación de producción de la rama.

**El inventario.** Antes de proponer nada, la AI leyó el README, la propuesta de AWS y los `design.md`, y comprobó en el código cada hueco que iba a nombrar: la web solo tenía `poweredByHeader: false`; `refresh`, `logout` y las cuatro operaciones de transferencias no tenían límite; `no-store` solo estaba en el estado de cuenta; la API mandaba cinco correos y ninguno avisaba de un inicio de sesión, y el CI no tenía escaneo de seguridad. Separó lo implementado, lo que ya estaba en "qué haría con más tiempo" y lo pendiente que solo vivía en otros documentos (rotación del secreto JWT, revocación del access token, timeouts de la base, dos saltos de proxy, el candado en Redis, el rol de soporte y la retención de la auditoría).

**Decisiones mías:** aviso en **cada** inicio de sesión con contraseña (avisar solo desde un dispositivo nuevo quedó en el README) y comprobante solo para **quien envía**, en transferencias a terceros.

**Qué se hizo:**
- **Límites de tasa:** por IP en `refresh` (120 cada 15 min) y `logout` (60); por usuario en crear (30 cada 10 min), confirmar (15 cada 15 min), reenviar el código (6) y cancelar (20). Solo el tope es configurable. El contrato 1.6.0 declara el `429` de `logout`.
- **`Cache-Control: no-store`** en toda la API.
- **Web:** CSP con nonce por petición, `nosniff`, `X-Frame-Options`, `Referrer-Policy` y `Permissions-Policy`, y HSTS solo con HTTPS.
- **Cuatro correos** (inicio de sesión, sesión cerrada por reuso, alta de beneficiario y comprobante) que salen después del `COMMIT` sin hacer esperar la respuesta, con un `drain()` de 5 s en el apagado. El BFF reenvía el `User-Agent` del navegador y la app manda el suyo.
- **15 puntos nuevos** en "qué haría con más tiempo".

**Revisión por etapas.** El subagente se detuvo después de escribir el change y la AI revisó el diseño antes de que tocara código. Aceptó topes más altos que los que había sugerido (por la IP compartida y los 3 intentos del OTP), aceptó los avisos sin esperar al SMTP con dos condiciones (un `catch` por envío y `drain()` en el apagado) y agregó corregir el correo del OTP, que pedía "cambia tu contraseña" sin que exista esa función.

**Hallazgos de esta sesión:**
- **`no-referrer` habría roto todas las Server Actions.** El subagente lo detectó al diseñar: con esa política el navegador manda `Origin: null` en los POST del mismo origen. Se eligió `strict-origin-when-cross-origin`, y la prueba e2e de inicio de sesión lo cubre.
- **La compilación de producción encontró lo que `next dev` escondía.** `/register` y `/_not-found` se prerenderizaban sin nonce y el navegador bloqueaba sus scripts: el layout raíz ahora espera `connection()`. Zod 4 prueba `Function("")` y Chromium lo reporta como una violación de `eval`: `instrumentation-client.ts` fija `jitless`.
- **Un aviso podía cambiar la respuesta.** Al revisar el código, la AI vio que el alta de beneficiario y el reuso de sesión buscaban al dueño después del `COMMIT` sin protección: si esa lectura fallaba, la respuesta era `500` aunque el alta ya existiera. Ahora la falla solo se registra, con una prueba por caso.
- **HSTS se decidía al compilar.** Al preparar el entorno de Haiku, la AI levantó la web con `SESSION_COOKIE_SECURE=false` y vio `Strict-Transport-Security` en la respuesta: `headers()` de `next.config` se evalúa en `next build` y queda en `routes-manifest.json`. La prueba de producción no lo detectó porque compilaba y arrancaba con el mismo entorno. HSTS pasó a `proxy.ts`, y la prueba ahora compila sin la variable y arranca con `false`; con HSTS de vuelta en `headers()`, falla.
- **Una función de `Permissions-Policy` que Chrome no reconoce.** Haiku vio "Unrecognized feature: 'bluetooth'" en la consola de cada página. Se quitó, y la prueba e2e falla ante cualquier aviso de ese header. El diseño afirmaba que todas las funciones eran reconocidas sin haberlo comprobado.
- **`db:bootstrap` volvió a apuntar al contenedor equivocado** (el hallazgo de la sesión 6). Sin `psql` instalado, el script usó `docker compose exec` y corrió `bootstrap.sql` en el PostgreSQL del 5433. El script es idempotente y las contraseñas eran las mismas, así que no cambió nada; la AI lo comprobó antes de seguir.
- **El README contradecía `registration-review`.** "Códigos por correo" todavía decía que un choque de CURP, RFC o teléfono respondía `422`. Se corrigió.

**Cómo se comprobó:**
- **Cada prueba nueva se vio fallar:** con TDD en la API; en la web y la app, donde el comportamiento ya existía, rompiendo a propósito la condición que cierra la sesión.
- **Suites:** la AI corrió de nuevo todas las de la rama: API, 606 unitarias y 812 de integración; web, 854 unitarias, 61 e2e y 8 contra la compilación de producción; app, 434; contrato, 579.
- **Panel completo:** Haiku recorrió en la compilación de producción el registro normal y el que queda en revisión, la sesión, Inicio, movimientos, estado de cuenta, beneficiarios, transferencias con OTP, límite diario, saldo insuficiente, doble clic, programadas, los cuatro correos y el `429`. No hubo violaciones de la política de contenido.

**Pendiente:**
- El `User-Agent` de la app no se ha visto llegar desde un teléfono real.
- HSTS con HTTPS real solo tiene prueba unitaria.
- `test:e2e:prod` no corre en el CI.
- `/favicon.ico` responde 404 (ya pasaba antes de la rama).

## Correcciones a la AI, en conjunto

Índice de lo que la AI propuso mal o dejó inseguro, ordenado por lo que importa en un sistema de dinero. Cada punto está explicado en la sesión que se indica.

### Con el dinero y la integridad de datos

| Qué pasó | Sesión | Cómo se detectó | Resolución |
| -------- | ------ | --------------- | ---------- |
| Los montos con `float` pierden un centavo (`Math.round(1.005 * 100)` da `100`) y PostgreSQL redondea en silencio al convertir | 1 | La AI lo señaló al revisar el enunciado | Montos como string decimal validado; `BIGINT` en centavos; lo inválido se rechaza, nunca se redondea |
| Proponía eximir del OTP las transferencias entre cuentas propias | 1 | Lo rechacé al revisar la propuesta | Todo monto mayor al umbral pide OTP, sin excepciones |
| El "día" del límite diario en UTC se reiniciaría a las 18:00 en México | 1 | Riesgo señalado antes de implementar | Día calendario en `America/Mexico_City` con pruebas en 17:59, 18:00, 23:59 y 00:00 |
| Carrera en el límite diario: dos transferencias desde cuentas distintas del mismo usuario podían superarlo | 1 | Riesgo señalado antes de implementar | Fila contador por usuario protegida por `CHECK` |
| IDOR en `fromAccountId`: sin verificar la propiedad, un usuario podría vaciar la cuenta de otro | 1 | Riesgo señalado antes de implementar | La propiedad se verifica en la misma consulta que toma el lock |
| `now()` de PostgreSQL devuelve la hora de inicio de la transacción | 1 | Riesgo señalado antes de implementar | La hora se toma después de obtener los locks |
| El diseño de bloqueo con `FOR UPDATE` producía un deadlock real con las llaves foráneas (`FOR KEY SHARE`) | 1 | La AI corrigió su propio diseño al bajarlo al detalle | `FOR NO KEY UPDATE` en orden global y determinista |
| El OTP guardado con un hash simple se revierte por fuerza bruta si la tabla se filtra | 1 | La AI corrigió su propio diseño | HMAC-SHA256 con un secreto del servidor |
| Cambio de día mientras se espera un lock | 1 | La AI corrigió su propio diseño | `ROLLBACK` y un reintento |
| Una prueba de doble clic de la web no probaba el candado: pasaba sin él | 4 | El subagente de las programadas, al revisar su propio trabajo | Pruebas con dos clics dentro de un mismo `act`, que sí fallan sin el candado |
| `HEAD` sobre el estado de cuenta generaba el PDF y registraba `STATEMENT_EXPORTED` sin entregar nada | 4 | Lo reportó el subagente; la AI principal escribió primero la prueba | La ruta responde 405 con `Allow: GET` antes de generar |
| Una aserción de las programadas filtraba logs por un nivel numérico que pino no escribe, así que nunca podía fallar | 4 | El subagente, una tarea después | Aserción corregida; es la que detecta la doble ejecución |
| La barrera de la carrera del tope de programadas se rendía en silencio | 5 | La auditoría de cobertura | Usa el helper que lanza error, y retrasar la segunda petición la hace fallar |
| Una mutación de BEN-07 que la prueba de integración no detectaba (el índice único lo impide antes) | 5 | Mutación deliberada | La prueba unitaria sí falla |
| La agrupación por día creaba los formateadores de zona horaria al importar, sin respaldo, y tomaba los meses del ICU del motor ("sep" o "sept") | 7 | La revisión final de la fase A | Formateadores al primer uso, UTC−6 fijo si el motor no conoce la zona y una tabla de meses propia |
| El comprobante móvil de una transferencia fallida fijaba el estado `FAILED` en lugar de leer el de la API | 7 | La revisión de la tarea 7.5 | Usa el estado que devuelve la API |
| Deslizar para actualizar Movimientos en el móvil pedía `/accounts//movements` sin cuenta (`refetch` de TanStack Query 5 ignora `enabled`) | 7 | Las revisiones de la línea móvil | El `refetch` no corre sin una cuenta elegida, con su prueba |

### Con la seguridad y la identidad

| Qué pasó | Sesión | Resolución |
| -------- | ------ | ---------- |
| Aceptar el 409 de "email ya registrado" como riesgo permite enumerar cuentas | 1 | Verificación por correo: el registro siempre responde 202 |
| Entregar el OTP por consola, y luego como `devOtp` en la respuesta (podía llegar a producción) | 1 | Correo vía Mailpit |
| Refresh token en cookie `httpOnly` emitida por la API | 1 | BFF con la sesión en el servidor; los tokens nunca llegan al navegador |
| La rotación estricta del refresh token rompe con una red móvil inestable | 1 | Ventana de gracia de 30 segundos |
| Con el BFF, la API ve la IP del BFF y el rate limiting por IP deja de servir | 1 | Solo se confía en `X-Forwarded-For` del BFF o del ALB |
| `next dev` registraba la contraseña en los argumentos de la Server Action | 3 | `logging.serverFunctions: false`, con una prueba |
| Una afirmación sobre Amplify ("deja menos control de `allowedOrigins`") era falsa | 1 | Se verificó contra la documentación; se mantuvo Fargate con los argumentos que sí pesan |
| El paquete se nombró con el usuario de GitHub que devolvía `gh api user`, sin confirmarlo | 2 | Mi usuario es DevChrisVaz; no se infiere la identidad del entorno |
| Las pruebas en navegador adoptaban cualquier servidor que ya escuchara en su puerto (`reuseExistingServer: true`), que podía ser la API real | 7 | Playwright siempre levanta su API simulada y su `next dev` |
| Un aviso por correo podía convertir la respuesta en `500` si fallaba la búsqueda del dueño después del `COMMIT` | 12 | La falla solo se registra; una prueba por caso |
| HSTS en `headers()` de `next.config` quedaba fijo en el build, no al arrancar | 12 | HSTS en `proxy.ts`; la prueba de producción compila y arranca con entornos distintos |
| `bluetooth` en `Permissions-Policy`, una función que Chrome no reconoce | 12 | Se quitó; la prueba e2e falla ante cualquier aviso del header |

### De proceso

- **Tuberías que ocultan el código de salida** (`| tail`): ocurrió en las sesiones 2, 3 y 4, también en subagentes. La regla es no canalizar una verificación.
- **`git checkout` para revertir una mutación** descartó ediciones sin commit (sesión 3, en dos ocasiones); desde entonces se respalda el archivo antes.
- **El contrato 1.2.0 rompió los tres consumidores** porque el diseño supuso que instalarían la versión nueva cuando quisieran (sesión 4).
- **Los subagentes heredaron Opus** sin que lo pidiera y, en otra ocasión, copiaron una atribución equivocada (sesión 5).
- **Trailers en un párrafo aparte** (sesión 6).
- **Formato sin revisar y previews que rompían Prettier en el CI** (sesión 7): desde entonces cada tarea corre `format:check` antes del commit.
- **Una corrección escrita antes que su prueba** y un reporte sin la evidencia de rojo y verde (sesión 7).
- **Dos sesiones sobre el mismo producto a la vez** (sesión 7): la rama principal cambió de nombre y de historia mientras el rediseño trabajaba, y un `pkill -f vitest` de otra sesión mató corridas ajenas.
- **`FLUSHDB` en pruebas que corren en paralelo** sobre la misma base de Redis (sesión 9).
- **Un ID de requisito tomado a la vez por dos sesiones** (WEB-35, sesión 9): un ID libre en la base de una rama puede estar ocupado en el trabajo sin commit de otra sesión.
- **Una prueba de producción con el mismo entorno en el build y en el arranque** no detecta lo que se decide al compilar (HSTS, sesión 12).
- **`db:bootstrap` en un worktree alcanzó el contenedor principal** sin `psql` instalado (sesiones 6 y 12).

## Resumen del flujo spec-first

**Qué se hizo.** Primero se exploró el alcance con el enunciado, decisión por decisión (sesión 1). Después se escribió el contrato (`openapi.yaml`) y se especificaron los seis changes completos, cada uno con propuesta, requisitos con escenarios, diseño y tareas, y cada uno validado con `openspec validate --strict`. Solo entonces se escribió código de aplicación: el historial lo muestra, porque el commit `3caff74` ("define API contract and specify all six OpenSpec changes") es anterior al primer commit de `api/`, `web/` y `mobile/`. Cada tarea se implementó con TDD, con un commit y los trailers `Task:` y `Refs:`, y cada prueba lleva en su título el ID del requisito.

**Qué funcionó:**
- **Los IDs de requisito como hilo común.** Permiten que un subagente reciba una tarea acotada y que un revisor compruebe el resultado contra el requisito, no contra una opinión. La matriz de trazabilidad se genera con un script, no se afirma.
- **Escribir el contrato antes que los clientes.** Web, móvil y API se implementaron en paralelo sin integrarse a ciegas, y los tipos generados detectaron los cambios incompatibles en tiempo de compilación.
- **Las mutaciones para demostrar las pruebas.** Casi todos los errores serios de dinero (locks, orden de bloqueo, vencimiento del OTP, día en UTC) se descubrieron o se fijaron rompiendo la regla a propósito y viendo fallar una prueba.
- **Dejar que la AI se contradiga por escrito.** Varias de las mejores correcciones (el deadlock de `FOR UPDATE`, el hash del OTP) las hizo la propia AI al bajar el diseño al detalle, antes de escribir código.
- **Aprobar el diseño en lienzos antes de tocar las pantallas** (sesión 7). El rediseño se revisó como prototipo y se aplicó solo después, y la paridad se midió en píxeles, no a ojo.

**Qué no funcionó o costó caro:**
- **Specs que se desactualizan.** Hubo textos de escenarios, descripciones de tareas y planes de reversión que el código obligó a corregir; se corrigieron en el mismo commit y se dejó constancia.
- **Verificar solo el paquete que se cambió** (el contrato 1.2.0) rompió a los consumidores. Un cambio compartido se verifica con todos sus consumidores.
- **Alcance mayor al estimado:** el trabajo excedió las 10 a 14 horas del enunciado. Fue una decisión mía, consciente, y está declarada en el README.

**El rediseño:** la sesión de `redesign` se ejecutó en su propia rama y su entrada, la sesión 7, llegó con ella. Lo que queda pendiente de esa sesión (subir los lienzos a Claude Design y la verificación en Expo Go) está al final de su entrada.
