## Why

La web y la app móvil son proyectos independientes que se construyen en paralelo. Sin una base visual común, cada una elegiría sus propios colores, tamaños, estados y textos de error, y TreoWallet se vería y hablaría distinto en cada plataforma. Además, la paleta de la marca de referencia (Treo) tiene combinaciones que no pasan contraste WCAG para texto, y una app financiera no puede dejar un saldo o un error ilegible. Este change define esa base antes de que web y móvil construyan sus pantallas.

## What Changes

- Nuevo proyecto `/design-tokens`: paquete `@devchrisvaz/wallet-design-tokens`, sin dependencias de runtime, que los clientes instalan igual que el contrato (`file:../design-tokens` con `install-links=true`).
- Identidad tomada de treo.mx (paleta, Work Sans, botones en píldora, tarjetas de radio 9 px), con ajustes de accesibilidad y colores de estado que Treo no define. Marca "TreoWallet" como logotipo de texto, sin el logo de Treo.
- Tokens semánticos en un tema claro, estructurados para agregar un tema oscuro sin tocar componentes.
- Salidas por plataforma generadas de una sola fuente: TypeScript, variables CSS con `@theme inline` para Tailwind v4 (web) y un tema para React Native (móvil).
- Convenciones de dinero, estados de transferencia y tipos de movimiento como datos compartidos, más los textos de la interfaz (mensajes por `ProblemCode`, etiquetas) en español de México.
- Inventario de componentes con sus variantes, estados y reglas de accesibilidad, que web y móvil implementan cada uno con su tecnología.
- Referencia visual local (HTML generado) y CI propio.

**Proyectos que toca:** `/design-tokens` (nuevo) y `.github/workflows/design-tokens.yml`. Los changes `web-app` y `mobile-app` se actualizan para consumirlo.

**Historias de usuario que habilita:** todas las que tienen interfaz (HU1 a HU6): formularios, saldos, beneficiarios, transferencias, historial y OTP con la misma apariencia y los mismos textos en web y móvil.

## Capabilities

### New Capabilities
- `design-system`: tokens visuales, convenciones de dinero y estados, textos compartidos e inventario de componentes de TreoWallet, distribuidos como paquete independiente para web y móvil.

### Modified Capabilities
<!-- Ninguna capability vigente cambia de requisitos. web-app y mobile-app aún no están archivados; sus artefactos se ajustan para consumir este paquete. -->

## Impact

- **Código nuevo:** `/design-tokens` (fuente de tokens, generadores, pruebas de contraste, referencia HTML) y su workflow de CI.
- **Changes afectados:** `web-app` deja de tener "sistema de diseño propio" como non-goal y usa estos tokens con Tailwind; `mobile-app` usa el tema de React Native y Work Sans con `@expo-google-fonts/work-sans`.
- **Dependencias:** ninguna de runtime. Herramientas de desarrollo iguales a las de `/contract` (TypeScript 5.9, tsup, Vitest, ESLint, Prettier).
- **Marca:** se toma la dirección visual de Treo para una prueba técnica dirigida a Treo; no se copian logotipos ni fuentes con licencia (Work Sans es OFL).
