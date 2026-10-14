## 1. Paquete del contrato

- [x] 1.1 [contract] La prueba de humo crea un cliente con `import` y con `require` y hace una petición con un `fetch` propio; se ve fallar con `require` y se corrige con el interop de D1 (CTR-15)
- [x] 1.2 [contract] `ProblemError.retryAfter` desde `Retry-After` en `toProblemError`; pruebas con `300`, sin header, `0`, `-5`, `1.5`, `abc` y una fecha HTTP (CTR-07)
- [x] 1.3 [contract] Versión 1.1.0 en `package.json` e `info.version`, y README con `retryAfter` (CTR-02, CTR-07, CTR-15)

## 2. Web

- [x] 2.1 [web] Reinstalar el paquete 1.1.0 y reemplazar `problemWithRetryAfter` y `retryAfterOf` por `error.retryAfter`; las pruebas de WEB-12 siguen pasando (WEB-12, CTR-07)

## 3. Móvil

- [ ] 3.1 [mobile] Reinstalar el paquete 1.1.0 y reemplazar `retryAfterMiddleware` y `retryAfterSeconds` por `error.retryAfter`; las pruebas de MOB-01 siguen pasando (MOB-01, CTR-07)
