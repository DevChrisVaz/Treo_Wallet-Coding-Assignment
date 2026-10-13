/** Pila tipográfica web: Work Sans (la tipografía de treo.mx) con respaldos del sistema. */
export const fontFamily = {
  sans: '"Work Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
} as const;

export type FontWeight = 400 | 500 | 600;

/**
 * Familia por peso en React Native (`@expo-google-fonts/work-sans`): React Native no sintetiza
 * pesos de una fuente cargada a mano, así que cada peso es su propia familia.
 */
export const nativeFontFamily: Record<FontWeight, string> = {
  400: 'WorkSans_400Regular',
  500: 'WorkSans_500Medium',
  600: 'WorkSans_600SemiBold',
};

export interface TextStyle {
  fontSize: number;
  lineHeight: number;
  fontWeight: FontWeight;
  letterSpacing: number;
}

/** Escala tipográfica en px. Tamaño mínimo: 12 px. */
export const typography = {
  display: { fontSize: 40, lineHeight: 48, fontWeight: 600, letterSpacing: -0.5 },
  h1: { fontSize: 32, lineHeight: 40, fontWeight: 500, letterSpacing: -0.5 },
  h2: { fontSize: 24, lineHeight: 32, fontWeight: 500, letterSpacing: -0.25 },
  h3: { fontSize: 20, lineHeight: 28, fontWeight: 500, letterSpacing: 0 },
  body: { fontSize: 16, lineHeight: 24, fontWeight: 400, letterSpacing: 0 },
  bodySm: { fontSize: 14, lineHeight: 20, fontWeight: 400, letterSpacing: 0 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: 500, letterSpacing: 0 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: 400, letterSpacing: 0.1 },
} as const satisfies Record<string, TextStyle>;

export type TypographyStyle = keyof typeof typography;

/** Espaciado de base 4 px. */
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

/** Radios en px: `md` es el de las tarjetas de Treo y `pill` el de sus botones. */
export const radius = { sm: 6, md: 9, lg: 16, pill: 9999 } as const;

/** Un solo nivel de elevación, para tarjetas: el diseño de Treo es casi plano. */
export const elevation = {
  card: {
    css: '0 1px 2px rgb(0 26 5 / 0.06), 0 1px 3px rgb(0 26 5 / 0.1)',
    native: {
      shadowColor: '#001A05',
      shadowOpacity: 0.1,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
  },
} as const;

/** Anillo de foco visible (color: `border.focus` del tema). */
export const focusRing = { width: 2, offset: 2 } as const;

/** Área táctil mínima en px. */
export const touchTarget = 44;

/** Duraciones en ms. Con movimiento reducido, los clientes no animan. */
export const motion = { fast: 150, base: 250, easing: 'cubic-bezier(0.2, 0, 0, 1)' } as const;
