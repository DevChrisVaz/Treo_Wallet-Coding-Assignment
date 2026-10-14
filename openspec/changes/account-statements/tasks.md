Requiere `contract-v1-2` (paquete 1.2.0) y la tarea 1.1 de `scheduled-transfers` (etiquetas de los estados nuevos en `/design-tokens`).

## 1. API

- [x] 1.1 [api] Instalar el contrato 1.2.0 y `@devchrisvaz/wallet-design-tokens` con `file:` e `install-links=true`; el CI de la API construye ambos paquetes y se dispara con cambios en `design-tokens/**`; las pruebas vigentes siguen pasando (HIS-11)
- [x] 1.2 [api] Dominio: `StatementPeriod` (patrón, mes futuro, mes en curso parcial, inicio y fin en la Ciudad de México con la base IANA) con pruebas unitarias (HIS-11, HIS-12)
- [x] 1.3 [api] Dominio: `StatementSummary` con `BigInt` (abonos, cargos, saldo final y verificación de conciliación) con pruebas del mes vacío y del descuadre (HIS-12)
- [x] 1.4 [api] Proyección de asiento a movimiento compartida con el historial; las pruebas de HIS-03 siguen pasando sin cambios (HIS-12)
- [x] 1.5 [api] `PgStatementReader` con instantánea `REPEATABLE READ READ ONLY`, saldo inicial y tandas ascendentes por keyset; pruebas de integración del orden, del movimiento de noche y de la transferencia confirmada a mitad de la lectura (HIS-12)
- [x] 1.6 [api] `PdfKitStatementRenderer` con Work Sans incrustada y su licencia, etiquetas del paquete de diseño, montos con `formatMXN`, encabezados repetidos, "Página X de Y", leyenda y mes vacío; pruebas que leen el texto del PDF (HIS-12)
- [x] 1.7 [api] Migración de `ck_audit_log_action` con `STATEMENT_EXPORTED` (con `down`) y el evento en el catálogo del dominio (AUD-07)
- [ ] 1.8 [api] Caso de uso `GenerateStatement` y ruta `getAccountStatement` con headers y límite de 10 por minuto por usuario; pruebas de integración de 200, 404, 422 (formato y mes futuro), 429, conformidad con el contrato y auditoría (incluida la falla al auditar y la ausencia de evento en los rechazos) (HIS-11, AUD-07)
- [ ] 1.9 [api] Prueba de rendimiento con 5,000 movimientos (menos de 5 segundos, varias páginas, "Página N de N") y sección "Estado de cuenta" en el README con el tiempo y el tamaño medidos (HIS-12)

## 2. Web

- [ ] 2.1 [web] Instalar el contrato 1.2.0; el proxy de lecturas agrega la ruta del estado de cuenta a la lista blanca y entrega el cuerpo binario con `Content-Type`, `Content-Disposition` y `Content-Length`; pruebas de bytes idénticos, segmento extra con 404 y método distinto de GET (WEB-32, WEB-09)
- [ ] 2.2 [web] Componente `StatementDownload` con el selector de mes (reloj fijo en las pruebas), estado ocupado, una sola petición ante doble clic, nombre de archivo de `Content-Disposition` y mensaje por código con la espera; prueba de `axe` (WEB-32)
- [ ] 2.3 [web] `StatementDownload` en la pantalla de movimientos; las pruebas de WEB-14 siguen pasando; README de la web con la descarga (WEB-32, WEB-14)

## 3. Verificación

- [ ] 3.1 [docs] Verificación manual contra la API real: descargar desde la web el estado de septiembre de 2026 de la "Principal" de Ana y el del mes en curso, abrirlos y comprobar el resumen contra la base con las consultas de conciliación del README de la API (HIS-11, HIS-12, WEB-32)
