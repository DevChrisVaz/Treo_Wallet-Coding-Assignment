## Why

En local, las sesiones del BFF viven en un `Map` dentro del proceso de Next.js (D2 de `web-app`). Cada vez que el servidor se reinicia (un `next build` seguido de `next start`, un cambio de configuración, otra sesión de trabajo que levanta la web), todas las sesiones se pierden: la cookie del navegador sigue apuntando a un id que el proceso nuevo no conoce y el usuario vuelve al inicio de sesión aunque su refresh token siga vigente en la API. Pasó el 2026-10-14: una sesión iniciada a las 16:16 terminó al reiniciarse la web a las 16:23, sin que la API rechazara ninguna renovación.

Además, el almacén de AWS (Redis, D5 de `delivery`) no se ejercita en ningún lado: solo la implementación en memoria tiene pruebas.

## What Changes

- **Redis también en desarrollo.** `/web` trae su propio `docker-compose.yml` con un Redis 7 publicado solo en `127.0.0.1`.
- **`REDIS_URL` opcional.** Con la variable, el `SessionStore` es Redis; sin ella, sigue el `Map` en memoria (pruebas unitarias, build de CI, e2e con la API simulada).
- **Implementación en Redis del puerto `SessionStore`** con la misma expiración que WEB-03 (inactividad y vigencia absoluta), renovación atómica del plazo para no pisar los tokens de una renovación concurrente (WEB-04), y fallo rápido si Redis no responde, sin caer al almacén en memoria.
- **Pruebas contra Redis real.** El comportamiento de WEB-03 se prueba con la misma suite en las dos implementaciones; el CI de la web levanta un servicio Redis.

**Proyectos que toca:** `/web` y `/docs`. La API y el contrato no cambian.

**Historias de usuario:** ninguna nueva. Mejora la continuidad de la sesión de HU1 (inicio de sesión) en la web.

## Capabilities

### New Capabilities
<!-- Ninguna. -->

### Modified Capabilities
- `web-app`: la sesión sobrevive al reinicio del servidor web cuando hay un almacén externo configurado (WEB-37).

## Impact

- **`/web`:** `docker-compose.yml` nuevo; `lib/config.ts` (`REDIS_URL`); `lib/server/redis-session-store.ts` nuevo; `lib/server/session-store.ts` elige la implementación; dependencia `redis`; `.env.example`; README.
- **CI:** `.github/workflows/web.yml` agrega un servicio Redis y `TEST_REDIS_URL`.
- **`/docs`:** README raíz y `docs/ai-log.md`.
- **Riesgo:** bajo. Sin `REDIS_URL` el comportamiento es el de hoy. Con Redis caído, las páginas con sesión responden con error en vez de cerrar la sesión.
