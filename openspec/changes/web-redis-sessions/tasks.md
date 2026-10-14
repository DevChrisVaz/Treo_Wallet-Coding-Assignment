## 1. Redis en desarrollo

- [ ] 1.1 [web] `docker-compose.yml` de `/web` con Redis 7 solo en `127.0.0.1`, AOF con volumen y healthcheck (WEB-37)
- [ ] 1.2 [web] `REDIS_URL` opcional en la configuración del servidor, validada como `redis://` o `rediss://`, y documentada en `.env.example`; pruebas (WEB-37, WEB-09)

## 2. Almacén de sesiones

- [ ] 2.1 [web] Suite común del `SessionStore` con el comportamiento de WEB-03; la implementación en memoria la pasa con reloj falso (WEB-03)
- [ ] 2.2 [web] Implementación en Redis: hash por sesión con TTL, `touch` atómico en Lua y conexión por proceso que falla rápido; pasa la suite común y sus pruebas propias contra Redis real (WEB-37, WEB-03, WEB-04)
- [ ] 2.3 [web] `sessionStore()` usa Redis cuando hay `REDIS_URL`; pruebas de reinicio y de Redis caído (WEB-37)
- [ ] 2.4 [web] CI de la web con un servicio Redis y `TEST_REDIS_URL` (WEB-37)

## 3. Documentación

- [ ] 3.1 [docs] README de `/web` y README raíz: `docker compose up -d` de `/web`, `REDIS_URL` y `TEST_REDIS_URL` (WEB-37)
- [ ] 3.2 [docs] `docs/ai-log.md` con la causa de la sesión perdida y las decisiones de este change (WEB-37)
