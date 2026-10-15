## Context

Los nueve correos transaccionales arman su HTML con `layout(title, body)` (`api/src/platform/mail/html.ts`) y, en su mayoría, con `<p>` por línea. No hay CSS inliner, ni imágenes, ni configuración de URL pública en la API. La identidad vive en `design-tokens` (verde `#1C4B42`, lienzo arena, tarjeta blanca de 9 px, Work Sans), que la API ya consume en el PDF del estado de cuenta.

## Decisions

### D1. Una sola envoltura, con tablas y estilos en línea
Los clientes de correo ignoran las variables CSS, los `@font-face` y gran parte de flex/grid. La envoltura usa tablas, estilos en línea y colores hexadecimales tomados de `theme.colors`. Así el cambio visual cae en un solo lugar y los nueve correos lo heredan.

### D2. Logotipo de texto, sin imágenes
"Treo" en blanco y "Wallet" en lima sobre la banda verde (el lima solo es válido sobre `#1C4B42`, DSG-14). DSG-02 prohíbe los archivos de logotipo de Treo, y una imagen exigiría una URL pública (nueva variable de entorno) o un `cid:` que varios clientes bloquean. Un icono de aplicación en imagen queda fuera de alcance.

### D3. Piezas pequeñas en lugar de plantillas
`paragraph`, `codeBlock`, `detailRows` y `noticeBox` viven junto a `layout()` y escapan siempre su contenido. Los constructores de correo siguen siendo funciones puras que devuelven `{subject, text, html}`; el texto plano no cambia, así que las pruebas de contenido y de escape siguen valiendo.

### D4. Work Sans con respaldo del sistema
Los correos no cargan fuentes web de forma fiable: se declara Work Sans y, si el cliente no la tiene, la fuente del sistema.

## Risks / Trade-offs

- El HTML de correo no se prueba en clientes reales (Outlook, Gmail); se revisó en un navegador a 420 px y en Mailpit. Las tablas y los estilos en línea son la práctica de compatibilidad, pero no una garantía.
- Sin tema oscuro: se declara `color-scheme: light`.
- Un lienzo local (`api/.design-sync/`) permite revisar los nueve correos juntos; es una ayuda de revisión, no parte del producto.
