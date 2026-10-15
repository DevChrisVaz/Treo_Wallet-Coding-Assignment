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
  displayXl: { fontSize: 48, lineHeight: 56, fontWeight: 600, letterSpacing: -0.5 },
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

/** Tres niveles de elevación: tarjeta, flotante y hoja inferior. El diseño de Treo es casi plano. */
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
  raised: {
    css: '0 4px 12px rgb(0 26 5 / 0.08), 0 1px 3px rgb(0 26 5 / 0.1)',
    native: {
      shadowColor: '#001A05',
      shadowOpacity: 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
  },
  sheet: {
    css: '0 -8px 24px rgb(0 26 5 / 0.12)',
    native: {
      shadowColor: '#001A05',
      shadowOpacity: 0.12,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: -8 },
      elevation: 16,
    },
  },
} as const;

/** Anillo de foco visible (color: `border.focus` del tema). */
export const focusRing = { width: 2, offset: 2 } as const;

/** Área táctil mínima en px. */
export const touchTarget = 44;

/** Duraciones en ms. Con movimiento reducido, los clientes no animan. */
export const motion = { fast: 150, base: 250, easing: 'cubic-bezier(0.2, 0, 0, 1)' } as const;

/** Tamaños de icono en px (Lucide, trazo de 2 px). */
export const iconSize = { sm: 16, md: 20, lg: 24 } as const;

/**
 * Tamaños de avatar en px, por uso: `sm` (32) para la persona en la navegación lateral de la web;
 * `md` (40, el de omisión) para las filas de movimientos, destinatarios y beneficiarios, y el avatar
 * del menú de la cuenta (dentro de un área táctil de 44); `lg` (56) para los estados vacíos y el
 * comprobante.
 */
export const avatarSize = { sm: 32, md: 40, lg: 56 } as const;

/** Medidas de layout compartidas por la web y la app móvil (paridad, D3 y D5 del rediseño). */
export const layout = {
  tabBarHeight: 64,
  appColumnMax: 480,
  sidebarWidth: 248,
  contentMax: 1200,
} as const;

/** Puntos de cambio de la web en px: columna de app centrada y forma de dashboard. */
export const breakpoints = { app: 480, dashboard: 1024 } as const;
