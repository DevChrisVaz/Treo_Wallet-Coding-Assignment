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
