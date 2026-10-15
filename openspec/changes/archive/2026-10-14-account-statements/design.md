## Context

El historial (`api-ledger`, HIS-01 a HIS-10) ya resuelve la proyección de un asiento a movimiento: tipo, contraparte, concepto, referencia y saldo posterior. También resuelve los días calendario de la Ciudad de México y el índice por cuenta y fecha. El estado de cuenta es otra vista de los mismos asientos: un mes completo, en orden ascendente, con un resumen que debe cuadrar.

Ana tiene 4,933 movimientos en septiembre de 2026 en su "Principal" (seed). Esa es la escala de referencia: un documento de unas 100 páginas.

## Goals / Non-Goals

**Goals:**
- Un PDF correcto y conciliado, generado en la API, con los mismos datos que el historial.
- Consistencia ante transferencias concurrentes.
- Pruebas que lean el texto del PDF generado.

**Non-Goals:**
- El estado de cuenta en la app móvil, que puede reutilizar la misma ruta más adelante.
- La firma digital del documento y el CFDI. Es un documento informativo.
- Envío por correo y estados de cuenta automáticos al cierre de mes.

## Decisions

### D1. PDFKit en la API
El documento se genera con PDFKit, que es JavaScript puro. Ofrece cuatro cosas que hacen falta aquí:
- incrusta fuentes (TTF, WOFF y WOFF2) con subconjunto de glifos;
- tiene `bufferPages`, que permite escribir "Página X de Y" al final;
- tiene API de texto con medición, para calcular el alto de los renglones;
- no depende de un navegador.

*Alternativas descartadas:*

| Alternativa | Por qué no |
|---|---|
| Chromium sin interfaz (Puppeteer) con HTML | Una imagen de unos 300 MB, arranque lento en Fargate y un proceso hijo por petición |
| `@react-pdf/renderer` | Mete React en la API para un solo documento |
| `pdf-lib` | Demasiado bajo nivel: no tiene maquetación de texto ni medición de renglones |
| Generarlo en el cliente | Duplicaría la lógica en la web y en la app, y la conciliación dejaría de estar en el servidor |

### D2. Módulo `statements` con capas
```
modules/statements/
  domain/          periodo (StatementPeriod), resumen y conciliación (StatementSummary) — puros, con BigInt
  application/     GenerateStatement (caso de uso) y puertos StatementReader, StatementRenderer
  infrastructure/  PgStatementReader, PdfKitStatementRenderer, ruta HTTP
```
`GenerateStatement` sigue estos pasos:
1. Valida el periodo contra el `Clock`.
2. Abre la instantánea del lector.
3. Verifica la propiedad de la cuenta (404).
4. Acumula el resumen mientras el renderizador recibe los renglones por tandas.
5. Verifica la conciliación.
6. Registra `STATEMENT_EXPORTED`.
7. Devuelve los bytes y el nombre del archivo.

La regla de capas de ESLint aplica igual que en los demás módulos.

### D3. Instantánea con `REPEATABLE READ READ ONLY`
El lector abre `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`. La primera sentencia fija la instantánea, y todas las lecturas siguientes ven exactamente el mismo estado de la base:
- la cuenta y su dueño;
- el nombre del titular;
- el saldo inicial;
- las tandas de movimientos.

Una transferencia que se confirma a mitad de la generación no aparece y el resumen cuadra (HIS-12). La interfaz del lector expone la instantánea como un objeto con métodos (`withSnapshot(async (snapshot) => …)`). Así, la prueba de concurrencia puede confirmar una transferencia en otra conexión entre la lectura del saldo inicial y la de los movimientos.

*Alternativas descartadas:*
- **`READ COMMITTED` con una sola consulta.** Una sola consulta sería consistente, pero obliga a traer los 5,000 renglones de golpe junto con el saldo inicial.
- **Calcular el saldo inicial como `SUM` de los asientos anteriores.** Escanea toda la historia de la cuenta. El `balance_after_cents` del último asiento anterior al periodo cuesta una lectura por índice.

### D4. Consultas
- **Saldo inicial:** `SELECT balance_after_cents FROM ledger_entries WHERE account_id = $1 AND created_at < $inicio ORDER BY created_at DESC, id DESC LIMIT 1`, que usa el índice existente del historial. Sin fila, el saldo inicial es 0.
- **Movimientos:** tandas por keyset de 1,000 en orden ascendente: `WHERE account_id = $1 AND created_at >= $inicio AND created_at < $fin AND (created_at, id) > ($ultimo) ORDER BY created_at, id LIMIT 1000`. El mismo índice se recorre hacia atrás, sin `Sort`.
- **Proyección compartida con el historial.** La proyección de asiento a movimiento (tipo, contraparte con nombre y últimos 4 dígitos de la CLABE, concepto, referencia) se extrae del lector de movimientos a una función o fragmento SQL compartido. Así, el historial y el estado de cuenta no divergen de HIS-03. Las pruebas vigentes del historial deben seguir pasando sin cambios.

### D5. Resumen y conciliación en el dominio
`StatementSummary` acumula los abonos (montos positivos) y los cargos (montos negativos, en valor absoluto) en centavos con `BigInt` mientras pasan los renglones. Al terminar verifica dos cosas:
- que `inicial + abonos − cargos` sea igual al `balance_after` del último renglón;
- si no hay renglones, que el saldo final sea igual al inicial.

Si la conciliación falla, el caso de uso lanza un error de invariante: la respuesta es 500, se registra un log de nivel ERROR y no se entrega el documento. Un estado de cuenta descuadrado nunca sale de la API.

### D6. Documento en memoria, no en streaming
El PDF se genera completo en memoria con `bufferPages: true`. Después se registra la auditoría y se responde con `Content-Length`. Con unos 5,000 renglones, el documento ronda las 100 páginas y pesa del orden de 1 a 2 MB. Los renglones sí se leen por tandas, así que la base nunca entrega el mes de golpe.

*Alternativa descartada:* hacer `doc.pipe(res)`, que es streaming. Tiene dos problemas:
- "Página X de Y" necesita conocer el total de páginas antes de cerrar el documento, y con streaming no se puede sin dos pasadas.
- Una falla a mitad del documento ya no podría responder `problem+json`, porque los headers ya se enviaron. El cliente recibiría un PDF truncado.

### D7. Maquetación
- **Página y márgenes:** tamaño carta vertical, márgenes de 36 pt.
- **Primera página:**
  - Encabezado con la marca "TreoWallet" en el color de acción del sistema de diseño (`#1C4B42`) y el título "Estado de cuenta".
  - Bloque de datos: titular, cuenta, CLABE completa, periodo ("1 al 30 de septiembre de 2026", o "1 al 14 de octubre de 2026 (parcial)") y "Generado el 14/10/2026 12:00 (hora de la Ciudad de México)".
  - Recuadro de resumen con las cuatro cifras.
- **Tabla:**

| Fecha | Tipo | Descripción | Cargo | Abono | Saldo |
|---|---|---|---|---|---|
| `dd/mm/aaaa hh:mm` | Etiqueta del tipo | Concepto en la primera línea; contraparte (`Luis •••• 0031`) y referencia en una segunda línea más pequeña | Alineado a la derecha | Alineado a la derecha | Alineado a la derecha |

- **Paginación:** los encabezados de la tabla se repiten en cada página. Renglones de altura fija, con el concepto truncado con "…" si no cabe, para que la paginación sea predecible.
- **Pie de página:** se agrega al final, recorriendo las páginas con `switchToPage`: "Página X de Y" y "Documento informativo; no es un comprobante fiscal."
- **Montos:** `formatMXN` del contrato, construido desde centavos sin floats. Producen "$1,250.50"; los cargos van sin signo en su columna.
- **Etiquetas de tipo:** vienen de `@devchrisvaz/wallet-design-tokens` (DSG-10). La API agrega esa dependencia con `file:../design-tokens` e `install-links=true`, igual que el contrato, y su CI también se dispara con cambios en `design-tokens/**`.
- **Tipografía:** Work Sans Regular y SemiBold, incrustadas. Se toman de un paquete npm de fuentes con licencia OFL. Si PDFKit no lee su formato, se versionan los TTF en `api/assets/fonts/` junto con `OFL.txt`.

*Alternativa descartada:* las fuentes estándar de PDF (Helvetica). No llevan la marca, y su codificación WinAnsi no cubre algunos caracteres, como el "•" de la contraparte.

### D8. Periodo y fechas
- **Validación:** `StatementPeriod.parse('YYYY-MM', clock)` valida el patrón y que el mes no sea posterior al mes en curso de la Ciudad de México.
- **Inicio y fin:**
  - el inicio es la medianoche local del primer día;
  - el fin es la medianoche local del primer día del mes siguiente, o el instante de generación si es el mes en curso.
- **Conversión a UTC:** se reutiliza la conversión de día local a instante UTC del historial (HIS-06), que usa la base IANA. Esto importa para los meses anteriores a 2023, cuando la Ciudad de México tenía horario de verano.
- **Sin límite inferior** aparte del patrón (2000 a 2099). Un mes anterior a la apertura de la cuenta responde un estado vacío con saldo 0.00. No se usa `accounts.created_at` como límite porque el seed crea las cuentas hoy con asientos de los 12 meses anteriores.

### D9. Ruta, headers y límite de tasa
- **Validación:** la ruta valida `accountId` y `period` con el contrato (PLT-02). Un periodo con formato inválido responde 422 `VALIDATION_FAILED` con el puntero del parámetro.
- **Headers de la respuesta:**
  - `Content-Type: application/pdf`;
  - `Content-Length`;
  - `Cache-Control: no-store`;
  - `Content-Disposition: attachment; filename="estado-de-cuenta-2026-09-0015.pdf"`.
- **Límite de tasa:** 10 por minuto, usando el `ClockMemoryStore` existente con la llave `statement:<userId>`, porque el límite es por usuario y no por IP. Se aplica después de autenticar.

### D10. Auditoría
- **Catálogo:** una migración recrea `ck_audit_log_action` con `STATEMENT_EXPORTED`, y su `down` restaura la lista anterior. El catálogo del dominio agrega el evento, y la prueba existente que compara el catálogo con la constraint lo cubre.
- **Transacción:** el evento no acompaña un cambio de negocio, así que se escribe en su propia transacción (AUD-03). Se escribe después de generar el documento y antes de responder. Si falla, la respuesta es 500.
- **Contenido:**
  - entidad `ACCOUNT` con el id de la cuenta;
  - metadatos `{ period }`.

### D11. Web: proxy binario y componente de descarga
- **Lista blanca:** agrega `accounts/<uuid>/statements/<YYYY-MM>`. Para esa ruta, el proxy:
  - pide `Accept: application/pdf, application/problem+json`;
  - devuelve `upstream.body` tal cual, en lugar de `upstream.text()`, que corrompería los bytes;
  - copia `Content-Type`, `Content-Disposition` y `Content-Length`.

  Las demás rutas no cambian.
- **`StatementDownload`** es un componente cliente con dos controles:
  - **Selector de mes:** las opciones se calculan con `mexicoCityDate` del contrato.
  - **Botón:**
    - pide el PDF con `fetch` al BFF;
    - si la respuesta es correcta, crea un `Blob` y descarga con un `<a download>` temporal, usando el nombre de `Content-Disposition`;
    - si es un `problem+json`, muestra `problemMessage` con la espera de `Retry-After`.

  Un estado `pending` impide un segundo clic. Se ubica en `MovementsScreen`, encima de los filtros, como componente independiente para que el rediseño lo reubique sin cambiarlo.

*Alternativa descartada:* un enlace `<a href download>` directo al BFF. Con él, un error navega fuera de la pantalla y muestra JSON, y no hay estado ocupado ni control del doble clic.

### D12. Pruebas
- **Dominio:** pruebas unitarias del periodo (meses límite, mes en curso, futuro y patrón) y del resumen (conciliación, mes vacío y descuadre).
- **Integración** contra PostgreSQL:
  - lector;
  - instantánea con una transferencia concurrente;
  - ruta: 200, 404, 422 y 429, conformidad de la respuesta con el contrato y auditoría.
- **Lectura del PDF:** una dependencia de desarrollo extrae el texto del PDF generado. Se elige entre `pdfjs-dist` y `unpdf` consultando su documentación actual. Las pruebas verifican:
  - el resumen y los montos formateados;
  - el número de renglones;
  - "Página N de N";
  - "Sin movimientos en el periodo";
  - la fecha del movimiento de noche.
- **Rendimiento:** la prueba inserta 5,000 movimientos en una cuenta con `generate_series`, como el seed, y mide que la ruta responda en menos de 5 segundos.
- **Web:** pruebas de la lista blanca, de los bytes idénticos y de los headers en el proxy. Pruebas del componente: opciones del selector con un reloj fijo, una sola petición ante doble clic, mensaje de `RATE_LIMITED` y `axe`.

## Risks / Trade-offs

- **[Riesgo] Memoria con meses enormes.** Un usuario con decenas de miles de movimientos en un mes generaría un documento grande en memoria.
  - Mitigación: el límite de tasa y el tamaño medido con 5,000 renglones, que se documentan.
  - Seguimiento documentado: un tope de renglones por documento, o una generación asíncrona con aviso por correo.
- **[Riesgo] La rama del rediseño también cambia `MovementsScreen`.** Mitigación: el control es un componente aparte. La integración solo agrega una línea en la pantalla.
- **[Trade-off] La API depende del paquete de diseño solo por etiquetas y un color.** Se acepta para que el PDF diga exactamente lo mismo que los clientes, por ejemplo "Traspaso enviado", sin copiar los textos.
