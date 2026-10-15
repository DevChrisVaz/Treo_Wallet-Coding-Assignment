## Why

Tres fallas de herramientas que la revisión de `security-hardening` dejó a la vista. Ninguna cambia lo que el producto hace por una persona, pero dos de ellas ya costaron tiempo y una pudo costar datos:

1. **`db:bootstrap` puede ejecutarse en un servidor distinto al de `BOOTSTRAP_DATABASE_URL`.** Sin `psql` instalado, el script cae a `docker compose exec postgres psql` dentro de `api/`. Ese comando ignora el host y el puerto de la URL y corre `bootstrap.sql` en el proyecto de compose que `api/` resuelva. El proyecto se llama `treo-api` en cualquier copia del repositorio, así que desde un worktree con su propio `.env` (otro puerto) el script reafirmó los roles y las contraseñas en el contenedor de la copia principal. Pasó dos veces (sesiones 6 y 12 de `docs/ai-log.md`). Una URL que dice "5443" no puede terminar tocando el 5433.
2. **El CI de la web no corre la verificación de la compilación de producción.** `npm run test:e2e:prod` (WEB-38, WEB-39) existe desde `security-hardening`, pero solo se corre a mano. Una regresión de la política de contenido que aparezca solo en `next start` pasaría el CI en verde.
3. **La web no tiene icono.** Cada página registra "Failed to load resource: 404 … /favicon.ico" en la consola, y el error queda mezclado con los que sí importan.

## What Changes

- **`db:bootstrap` solo actúa sobre el servidor de la URL (PLT-14).** Con `psql` instalado nada cambia. Sin él, el script solo usa el contenedor de compose si la URL apunta a esta máquina y a un puerto que el servicio `postgres` de compose publica; si no, termina con error y un mensaje que dice qué URL y qué servicio no coinciden y cómo arreglarlo. La decisión vive en una función pura con pruebas unitarias.
- **El CI de la web corre `npm run test:e2e:prod` (WEB-38, WEB-39)** después de las pruebas en navegador.
- **La web sirve un icono (WEB-41, nuevo).** `app/icon.svg` y `app/favicon.ico` con el monograma "T" blanco sobre un cuadrado redondeado del color de acción de la marca. Las pruebas e2e fallan ante cualquier recurso que no cargue, incluido el icono.
- **Documentación.** README raíz y de la API (el respaldo de `db:bootstrap`), README raíz y de la web (qué corre el CI de la web y el icono) y matriz de trazabilidad.

## Capabilities

### New Capabilities
Ninguna.

### Modified Capabilities
- `api-platform`: PLT-14 gana la regla de que el script de arranque solo actúa sobre el servidor de su URL.
- `web-app`: icono de la aplicación (WEB-41, nuevo).

## Impact

- **Proyectos:** `/api`, `/web`, `/docs` y `.github/workflows/web.yml`. `/contract`, `/design-tokens` y `/mobile` no cambian.
- **Historias de usuario:** ninguna; es mantenimiento de herramientas.
- **`/api`:** `scripts/db-bootstrap.ts` y un módulo nuevo con la decisión; pruebas unitarias. Sin cambios de comportamiento con `psql` instalado (el caso del CI).
- **`/web`:** `app/icon.svg`, `app/favicon.ico`, el `matcher` de `proxy.ts` y una ampliación de `e2e/security-headers.spec.ts`. Sin dependencias nuevas.
- **CI:** un paso nuevo en `web.yml` (un `next build` más, ver D4).
- **`/docs`:** README, READMEs de la API y la web, matriz de trazabilidad. La bitácora de AI la escribe quien revisa.
