## Context

`api/scripts/db-bootstrap.ts` ejecuta `db/bootstrap.sql` con un superusuario. Con `psql` instalado se conecta a `BOOTSTRAP_DATABASE_URL`. Sin `psql`, ejecuta `docker compose exec -T postgres psql -U <usuario de la URL> …` con `cwd` en `api/`: Docker Compose resuelve el proyecto por el `name: treo-api` del `docker-compose.yml`, que es el mismo en cualquier copia del repositorio (incluidos los worktrees de git). El host y el puerto de la URL no participan. Con un `.env` de worktree que apunta a otro puerto, el script actuó sobre el contenedor de la copia principal (sesiones 6 y 12 de `docs/ai-log.md`). Como `bootstrap.sql` es idempotente y reafirma las contraseñas de los roles, el daño fue silencioso: el contenedor ajeno quedó con las contraseñas del `.env` del worktree.

`web/package.json` define `test:e2e:prod` (`web/playwright.prod.config.ts`: `next build` sin `SESSION_COOKIE_SECURE`, `next start` con ella en `false`, contra `e2e/fake-api.mjs`, con `e2e/security-headers.spec.ts`), pero `.github/workflows/web.yml` solo corre `npm run test:e2e`.

La web no tiene icono. Next.js 16 registra solos los archivos `app/favicon.ico` y `app/icon.svg` (documentación de Next.js 16, convención de archivos de metadatos "app icons"): `favicon.ico` debe estar en la raíz de `app/` y genera `<link rel="icon" href="/favicon.ico" sizes="any">`; `icon.svg` genera su propio `<link rel="icon">` con una URL con huella. `web/proxy.ts` ya excluye `favicon.ico` en su `matcher`, como si existiera.

## Goals / Non-Goals

**Goals:**
- Que `db:bootstrap` no pueda ejecutarse nunca en un servidor distinto al de su URL, y que el CI (con `psql`) no cambie.
- Que una regresión de la política de contenido en la compilación de producción rompa el CI de la web.
- Que ninguna página registre un 404 por el icono y que las pruebas lo noten si vuelve a pasar.

**Non-Goals:**
- Cambiar `bootstrap.sql`, las demás `db:*` (usan la URL por TypeORM, siempre al servidor de su URL) o el `docker-compose.yml`.
- Un icono para la app móvil, `apple-icon` o un manifiesto web. Quedan fuera: la web no es instalable.
- Reutilizar el build del CI entre pasos (D4).

## Decisions

### D1. Fallback de `db:bootstrap`: una guarda antes del `compose exec` (opción a)
La decisión es una función pura `planBootstrap(url, deps)` en `api/scripts/bootstrap-plan.ts` que devuelve uno de tres planes: `psql` (se conecta a la URL), `compose` (se ejecuta en el contenedor) o `refuse` (error con un mensaje). `deps` inyecta `psqlAvailable()` y `composePorts()` (los puertos que publica el servicio `postgres`), así que las pruebas no usan Docker ni `psql`. El script solo ejecuta el plan.

Reglas, en este orden:
1. Con `psql` instalado: plan `psql`, igual que hoy. El CI no cambia.
2. Sin `psql`, el host de la URL debe ser de esta máquina (`localhost`, `127.0.0.1`, `::1`, con o sin corchetes). Si no, `refuse`: compose nunca llegaría a un servidor remoto.
3. `docker compose port postgres 5432` (desde `api/`) lista los puertos del host que publica el servicio. Si el comando falla o no lista nada (servicio apagado), `refuse`.
4. El puerto de la URL (5432 si no lo trae) debe estar entre esos puertos. Si no, `refuse` con un mensaje que nombra la URL (sin contraseña), el puerto que publica compose y las dos salidas: instalar `psql` o apuntar la URL a ese puerto.

La regla 4 es la que cierra el incidente: el worktree decía 5443 y compose publicaba 5433. Mantiene el comportamiento local de hoy (URL a `localhost:5433` y compose en 5433) y convierte el error silencioso en uno ruidoso.

- _Alternativa descartada:_ (b) un contenedor desechable de la imagen de PostgreSQL con `psql` que se conecte a la URL. Siempre apuntaría al servidor correcto, pero `localhost` dentro de un contenedor no es el host: en Linux exige `--network host`, que en Docker Desktop (macOS y Windows) conecta con la máquina virtual de Docker y no con el equipo, y la alternativa `host.docker.internal` / `--add-host host-gateway` obliga a reescribir el host de la URL y a depender de la versión de Docker. Es más código, más superficie y portabilidad distinta según el sistema, para un caso (equipos sin `psql`) que ya funciona con el contenedor de compose.
- _Alternativa descartada:_ (c) quitar el respaldo y exigir `psql`. Es lo más simple y seguro, pero rompe el arranque documentado para quien solo tiene Docker (README: "`psql` es opcional"), y esa comodidad es la razón por la que existe el respaldo.
- _Alternativa descartada:_ (d) fijar el contenedor con `docker compose -p <nombre por copia>`. Evitaría compartir el proyecto entre worktrees, pero cambia los nombres de los contenedores y volúmenes de quien ya trabaja, y no impide que una URL equivocada llegue a otro contenedor de otra copia que también publique el puerto. La guarda compara contra lo que realmente está publicado.
- _Alternativa descartada:_ comparar solo con `POSTGRES_PORT` o con el valor por defecto 5433. Compose lee `POSTGRES_PORT` de su propio `.env`, y puede diferir del que ve el script; `docker compose port` responde con el puerto realmente publicado.

**Contraseñas.** No cambian: `WALLET_MIGRATOR_PASSWORD` y `WALLET_APP_PASSWORD` siguen viajando por entorno (`-e NOMBRE` sin valor en el `compose exec`, `\getenv` en el SQL). El mensaje de error nunca imprime la contraseña de la URL.

### D2. Qué se considera "esta máquina"
Solo `localhost`, `127.0.0.1` y `::1`. No se resuelven nombres ni se comparan IP de la máquina: un nombre que resuelve a loopback pero no está en la lista se rechaza con el mensaje que explica cómo seguir. La guarda es de seguridad; ante la duda, se niega.

### D3. PLT-14 se modifica; no hay requisito nuevo
El arranque seguro de la base de datos es una propiedad del script que PLT-14 ya exige ("los roles MUST crearse con un script de arranque… con contraseñas de variables de entorno"). El cambio agrega una restricción a ese script, así que se escribe como `MODIFIED` de PLT-14 (con todos sus escenarios anteriores) y no como un PLT-21 aparte.

### D4. El CI de la web: un `next build` más, sin reutilizar el anterior
El paso nuevo es `npm run test:e2e:prod`, después de "Pruebas en navegador". El workflow ya corre `npm run build` y el comando del servidor de `playwright.prod.config.ts` vuelve a construir (`env -u SESSION_COOKIE_SECURE npm run build && … next start`).

Se acepta la compilación extra. Medida en este equipo: ~4 s con caché de Next.js caliente; en un runner limpio, del orden de decenas de segundos, frente a los minutos que ya cuestan `npm ci` y la instalación de Chromium.

- _Alternativa descartada:_ reutilizar el `.next` del paso "Build de Next.js" y arrancar solo `next start`. El build del CI tampoco recibe `SESSION_COOKIE_SECURE`, así que la propiedad se conservaría, pero dependería del orden de los pasos y de que `next dev` (usado por `test:e2e`, escribe en `.next/dev`) no toque lo construido. La corrida local (`npm run test:e2e:prod`) y la del CI dejarían de ser la misma, y un cambio en `playwright.prod.config.ts` podría volver a perder, sin aviso, que el build se hace sin `SESSION_COOKIE_SECURE`. El costo que se ahorra es pequeño.
- _Alternativa descartada:_ mover el paso nuevo a un job aparte. Repetiría `npm ci`, la compilación de `contract` y `design-tokens` y la instalación de Chromium para ahorrar un build.
- _Alternativa descartada:_ crear un requisito de CI de la web. Hoy ningún requisito de `web-app` describe su CI (el de la API, PLT-17, sí está especificado); lo que el paso verifica ya es WEB-38 y WEB-39 ("tanto con el servidor de desarrollo como con la compilación de producción"). El paso solo hace cumplir un requisito existente, así que la tarea cita esos IDs y no se agrega otro.

El paso lleva el nombre `Pruebas de la compilación de producción (headers y política de contenido, WEB-38, WEB-39)`, en el estilo de los demás. Los puertos de la configuración de producción (3105 y 4995) son distintos de los de desarrollo (3101 y 4999), así que las dos corridas no se estorban.

### D5. Icono: SVG escrito a mano y `.ico` generado con `sharp`
- **SVG** (`app/icon.svg`): un cuadrado redondeado de 32×32 con el color `action.primary` de `@devchrisvaz/wallet-design-tokens`, que en el tema claro es `palette.green900` (`#1C4B42`), y una "T" blanca (`text.onAction`) dibujada con un `<path>`, sin fuentes ni texto. Menos de 400 bytes. Escrito a mano: un icono de 32 px no justifica una herramienta de diseño.
- **ICO** (`app/favicon.ico`): contiene el mismo dibujo en 16, 32 y 48 px, en PNG dentro del contenedor ICO. Se genera una sola vez con `sharp` (que `next` ya trae como dependencia de imágenes; no se agrega nada a `package.json`) a partir del SVG, y el resultado se versiona. No hay un paso de build que lo regenere: el icono no cambia con el código.
- **Por qué los dos archivos:** el navegador pide `/favicon.ico` por su cuenta aunque la página declare otro icono (ocurre al abrir una URL sin HTML, y en varios navegadores antes de leer el `<head>`). Con solo `icon.svg` la petición implícita seguiría dando 404. El `.ico` cubre eso y el SVG da nitidez en pantallas de alta densidad y en pestañas con tema oscuro.
- **Contraste:** blanco sobre `#1C4B42` es la pareja `text.onAction` / `action.primary` que el paquete de diseño ya valida con AA.

- _Alternativa descartada:_ `app/icon.tsx` (icono generado en código con `ImageResponse`). Corre en el servidor en cada petición para un dibujo que no cambia.
- _Alternativa descartada:_ un PNG en lugar del `.ico`. `app/favicon.ico` es lo que cubre la petición implícita de `/favicon.ico`; un PNG se serviría en `/icon.png` y el 404 seguiría.
- _Alternativa descartada:_ poner el icono en `public/`. Funciona, pero `public/` no lo declara en el `<head>`; la convención de `app/` lo hace sola y le añade la huella para el caché.

### D6. Proxy, CSP y headers para las rutas del icono
- **Proxy.** El `matcher` ya excluye `favicon.ico`. Se agrega `icon.svg` (la ruta es `/icon.svg`, con una query de huella que el `matcher` no ve): son archivos estáticos sin nonce que poner, igual que `_next/` y el BFF. WEB-09 se mantiene.
- **CSP.** `img-src 'self' data: blob:` cubre un `<link rel="icon">` del mismo origen. Una prueba e2e lo confirma en el navegador, sin eventos `securitypolicyviolation`.
- **Headers estáticos.** `headers()` de `next.config.ts` usa `source: '/:path*'`; se comprueba con una petición real que `/favicon.ico` e `/icon.svg` llevan los headers de WEB-38.

### D7. Que las pruebas e2e noten un 404 de recurso
Hoy `security-headers.spec.ts` filtra los mensajes de consola por CSP y Permissions-Policy, y no registra "Failed to load resource" (el 404 de `/favicon.ico` nunca la habría hecho fallar). La prueba que recorre las pantallas pasa a registrar también los mensajes `error` de la consola y las respuestas con estado ≥ 400 de recursos del mismo origen (`page.on('response')`), y falla ante cualquiera, sin excepción para el icono. Se comprobó que sin el icono la prueba falla (404) y con él pasa. Cada pantalla se visita como antes, así que no cambian el tiempo ni los puertos.

- _Alternativa descartada:_ agregar una prueba aparte solo para el icono. Dejaría otras fallas de carga sin detectar; la causa raíz era que la prueba no miraba errores de carga.

## Risks / Trade-offs

- **La guarda rechaza usos legítimos poco comunes.** Un `localhost` con un túnel (`ssh -L`) a un servidor remoto, sin `psql`, ya no funciona con el respaldo. Es el compromiso buscado: instalar `psql` lo resuelve y el mensaje lo dice.
- **`docker compose port` depende de que Docker esté disponible.** Si falla, el mensaje lo dice; antes el `compose exec` fallaba igual.
- **El CI de la web gana un `next build`.** Segundos a decenas de segundos por corrida (D4).
- **El `.ico` es un binario versionado.** Pequeño (unos KB) y reproducible desde el SVG con el procedimiento de D5.
