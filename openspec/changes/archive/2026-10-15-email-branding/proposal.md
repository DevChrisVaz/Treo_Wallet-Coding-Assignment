## Why

Los correos transaccionales de la API (códigos, avisos y comprobantes) salen con una envoltura mínima: texto negro en fuente genérica, sin marca y con un pie que dice "Billetera" mientras todo lo demás dice "TreoWallet". La web y el PDF del estado de cuenta ya siguen el sistema de diseño (`design-tokens`); los correos no, y son lo primero que ve una persona al verificar su cuenta o confirmar una transferencia.

## What Changes

- **Envoltura de marca común (PLT-16).** `layout()` entrega una banda verde de marca con el logotipo de texto "TreoWallet", una tarjeta blanca sobre el lienzo arena, la fuente Work Sans con respaldo del sistema y un pie "TreoWallet · Este es un correo automático.". Se arma con tablas y estilos en línea, sin imágenes ni fuentes web, y con los colores de `@devchrisvaz/wallet-design-tokens` (dependencia que la API ya usa en el PDF).
- **Piezas reutilizables.** Párrafo, bloque de código de un solo uso, filas etiqueta/valor y recuadro de aviso con los colores de estado. Todas escapan su contenido.
- **Los 9 correos usan las piezas.** El texto plano y las frases no cambian; el comprobante de transferencia muestra monto, destino, concepto, fecha y número como filas.

## Capabilities

### New Capabilities
Ninguna.

### Modified Capabilities
- `api-platform`: PLT-16 gana la regla de presentación del HTML de los correos.

## Impact

- **Proyectos:** solo `/api` (`platform/mail/html.ts` y los constructores de correo de identidad, beneficiarios y transferencias). Sin cambios de contrato, de base de datos ni de dependencias.
- **Pruebas:** nuevas pruebas unitarias de la envoltura y de las piezas; las existentes de contenido y escape siguen igual.
- **Fuera de alcance:** imágenes o logotipo en archivo (DSG-02), tema oscuro, enlaces o botones (ningún correo los lleva hoy).
