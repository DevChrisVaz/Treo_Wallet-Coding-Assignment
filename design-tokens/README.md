# @devchrisvaz/wallet-design-tokens

Sistema de diseño de **TreoWallet**: tokens semánticos, salidas para Tailwind v4 (web) y React Native (móvil), convenciones de dinero y estados, y los textos de la interfaz. Lo consumen `/web` y `/mobile`; no tiene dependencias de runtime.

- Especificación: `openspec/changes/design-system/` (capability `design-system`, requisitos DSG-01 a DSG-12). Las tablas completas de tokens, componentes y mensajes están en su `design.md`.
- **Referencia visual:** `preview/index.html`, generada desde los tokens. Ábrela en el navegador (por ejemplo, `npx serve preview`). No se publica.

## Identidad

La dirección visual es la de [treo.mx](https://treo.mx), tomada de su kit global (Elementor/VamTam): verde profundo `#1C4B42` en las acciones, lima `#B4E717` en el estado activo, tinta `#001A05`, superficies `#EDF7ED` y `#F6F5F2`, **Work Sans**, botones en píldora y tarjetas con radio de 9 px. El nombre se muestra como logotipo de texto, "Treo" en tinta y "Wallet" en verde profundo; no se usa el logo de Treo.

Ajustes de accesibilidad (verificados por `test/contrast.test.ts`):

| Color de Treo            | Problema              | En TreoWallet                                                 |
| ------------------------ | --------------------- | ------------------------------------------------------------- |
| Verde de marca `#31C454` | 2.29:1 como texto     | Solo acento decorativo (`accent.brand`)                       |
| Gris `#7E7E7E`           | 4.06:1, no llega a AA | Texto secundario `#4B5A50` (7.30) y atenuado `#5F6B63` (5.57) |
| Borde negro al 10 %      | No llega a 3:1        | Borde de campo `#7F8A82` (≥ 3.26 en las tres superficies)     |
| Sin colores de estado    |                       | Éxito, aviso, error, información y neutro, con fondo suave    |

**Usa solo los pares de `contrastPairs`.** Un token de texto sobre una superficie que no está en la lista no tiene contraste garantizado.

## Instalación

Igual que el contrato: como artefacto, no como enlace simbólico.

```jsonc
// package.json del cliente
"@devchrisvaz/wallet-design-tokens": "file:../design-tokens"
```

```ini
# .npmrc del cliente
install-links=true
```

Si cambias los tokens: `npm run generate` aquí y `npm install` en el cliente para recibir la copia nueva.

## Web (Next.js + Tailwind v4)

```css
/* app/globals.css */
@import 'tailwindcss';
@import '@devchrisvaz/wallet-design-tokens/tailwind.css';
```

La hoja define las variables `--dt-*` en `:root` y **elimina la paleta, la escala de texto, los radios y las sombras por defecto de Tailwind**: `bg-red-500` o `text-sm` no existen. El espaciado por defecto se conserva porque ya es de base 4 (`p-4` = 16 px).

| Uso           | Utilidades                                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Superficies   | `bg-surface`, `bg-surface-subtle`, `bg-surface-brand`, `bg-surface-inverse`                                                                                   |
| Texto         | `text-fg`, `text-fg-secondary`, `text-fg-muted`, `text-fg-on-action`, `text-fg-on-action-active`, `text-fg-on-inverse`                                        |
| Acción        | `bg-action hover:bg-action-active text-fg-on-action hover:text-fg-on-action-active`, `disabled:bg-action-disabled disabled:text-fg-disabled`                  |
| Bordes y foco | `border-border`, `border-border-input`, `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus`                                  |
| Estados       | `bg-success-soft text-success`, `warning`, `danger`, `info`, `neutral`                                                                                        |
| Dinero        | `text-money-in`, `text-money-out`, siempre con `tabular-nums`                                                                                                 |
| Tipografía    | `text-display`, `text-h1`, `text-h2`, `text-h3`, `text-body`, `text-body-sm`, `text-label`, `text-caption` (cada una trae su interlineado, _tracking_ y peso) |
| Forma         | `rounded-sm`, `rounded-md` (tarjetas), `rounded-lg`, `rounded-pill` (botones, insignias), `shadow-card`                                                       |

**Fuente con `next/font`:** `next/font/google` sirve Work Sans con un nombre de familia generado, así que la pila `"Work Sans", …` no la encuentra. Expón su variable y redefine `--dt-font-sans`:

```ts
// app/layout.tsx
const workSans = Work_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-work-sans',
});
// <html className={workSans.variable}>
```

```css
:root {
  --dt-font-sans: var(--font-work-sans), system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}
```

## Móvil (Expo + React Native)

```ts
import { theme } from '@devchrisvaz/wallet-design-tokens/native';
import {
  useFonts,
  WorkSans_400Regular,
  WorkSans_500Medium,
  WorkSans_600SemiBold,
} from '@expo-google-fonts/work-sans';

const [fontsLoaded] = useFonts({ WorkSans_400Regular, WorkSans_500Medium, WorkSans_600SemiBold });
// Mantén la pantalla de carga de Expo hasta que fontsLoaded sea true.

const styles = StyleSheet.create({
  title: { ...theme.typography.h1, color: theme.colors.text.primary },
  balance: { ...theme.typography.display, ...theme.amount, color: theme.colors.text.primary },
  card: {
    backgroundColor: theme.colors.surface.brand,
    borderRadius: theme.radius.md,
    padding: theme.spacing[5],
    ...theme.elevation.card,
  },
  button: {
    minHeight: theme.touchTarget,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.action.primary,
  },
});
```

Los estilos de texto **no incluyen `fontWeight`**: cada peso es su propia familia (`WorkSans_500Medium`…). Si agregas `fontWeight` a una familia cargada a mano, Android puede mostrar la fuente del sistema.

Si Metro no resuelve el subpath por `exports`, la carpeta `native/` del paquete funciona como respaldo.

## Datos y textos compartidos

```ts
import {
  transferStatus,
  movementType,
  money,
  problemMessage,
} from '@devchrisvaz/wallet-design-tokens';
import type { MovementType, ProblemCode, TransferStatus } from '@devchrisvaz/wallet-contract';

// El paquete no depende del contrato: comprueba la exhaustividad en el cliente.
transferStatus satisfies Record<TransferStatus, unknown>;
movementType satisfies Record<MovementType, unknown>;

const { tone, label } = transferStatus[transfer.status]; // insignia: bg-<tone>-soft text-<tone>
const { direction } = movementType[movement.type];
const text = `${money[direction].sign}${formatMXN(abs)}`; // "+$1,500.00" o "−$850.50" (U+2212)
const message = problemMessage(error.code); // INTERNAL_ERROR si el code es desconocido
```

- Las salidas usan la tinta (`money.out`), **nunca** el color de error.
- Los mensajes siguen el tono de Treo: de "tú", qué pasó y qué hacer. Agrega los datos variables tú mismo ("Te quedan 2 intentos").

## Componentes

Cada cliente implementa con sus tokens el inventario de `design.md` (D7): `Wordmark`, `Button`, `TextField`, `AmountField`, `OtpField`, `Select`, `AccountCard`, `MovementRow`, `StatusBadge`, `InlineAlert`, `EmptyState`, `Skeleton`, `Receipt`, `DailyLimitMeter` y, en móvil, `PrivacyOverlay`. La referencia visual muestra cómo se ven.

Reglas comunes: área táctil de 44 px, foco visible con `border.focus`, el color nunca es la única señal (las insignias siempre llevan etiqueta), y sin animación cuando la persona prefiere movimiento reducido.

## Agregar un tema oscuro

1. En `src/themes.ts`, agrega `dark` con la forma `ThemeColors` (otros valores de la paleta, o colores nuevos agregados a `palette`).
2. Agrega sus pares a la prueba de contraste.
3. En `src/css.ts`, emite sus variables `--dt-*` bajo `[data-theme="dark"]` (y bajo `prefers-color-scheme: dark` si se quiere seguir al sistema).

Ningún componente cambia, porque todos usan tokens semánticos.

## Desarrollo

Herramientas en Node 24; el paquete construido funciona desde Node 20.

| Script                                                              | Qué hace                                                                                                                               |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                                                          | Pruebas: tokens, contraste WCAG, escala, convenciones, textos, CSS y referencia visual al día                                          |
| `npm run generate`                                                  | Construye y regenera `generated/tokens.css`, `generated/tailwind.css` y `preview/index.html`; el CI falla si difieren de lo versionado |
| `npm run build`                                                     | `dist/`: ESM, CJS y tipos para `.` y `./native`                                                                                        |
| `check:exports`, `check:no-node-imports`, `smoke`, `verify:install` | Rutas del paquete, compatibilidad con Hermes, `import`/`require` y la instalación local como copia sin dependencias                    |

**Aviso conocido:** `npm audit` reporta una vulnerabilidad baja de esbuild (servidor de desarrollo en Windows) que llega por tsup y Vite. Solo afecta a herramientas de desarrollo y este paquete no tiene dependencias de runtime.
