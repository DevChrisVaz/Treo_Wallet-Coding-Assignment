## 1. API: `db:bootstrap` seguro

- [x] 1.1 [api] La decisión del respaldo de `db:bootstrap` como función pura (`planBootstrap`, con `psql` y los puertos de compose inyectados) y `db-bootstrap.ts` que solo ejecuta el plan: con `psql`, igual que hoy; sin `psql`, solo si el host de la URL es local y su puerto lo publica el servicio `postgres` de compose, y si no, error en español que nombra la URL (sin contraseña) y el puerto de compose. Pruebas unitarias: con `psql` (cualquier host), URL local con el puerto de compose, puerto distinto, host remoto, `::1` y `[::1]`, puerto por defecto 5432, servicio apagado, varios puertos publicados, contraseña fuera del mensaje (PLT-14)

## 2. Web: CI e icono

- [x] 2.1 [web] Paso `npm run test:e2e:prod` en `.github/workflows/web.yml` después de las pruebas en navegador, con su nombre que cita WEB-38 y WEB-39; el YAML validado y la corrida local de `test:e2e:prod` en verde (WEB-38, WEB-39)
- [x] 2.2 [web] `app/icon.svg` (monograma "T" con el color `action.primary`) y `app/favicon.ico` (16, 32 y 48 px) generado desde el SVG; `icon.svg` fuera del `matcher` del proxy; la prueba e2e de las pantallas falla ante cualquier recurso del mismo origen que responda ≥ 400 o error de consola, y comprueba que `/favicon.ico` e `/icon.svg` responden `200` con los headers de WEB-38 y sin violaciones de la política; prueba del `matcher` actualizada (WEB-41, WEB-09, WEB-38, WEB-39)

## 3. Documentación

- [x] 3.1 [docs] README raíz y de la API: el respaldo de `db:bootstrap` y su guarda. README raíz y de la web: el paso del CI de la web y el icono (PLT-14, WEB-38, WEB-39, WEB-41)
- [ ] 3.2 [docs] Matriz de trazabilidad
