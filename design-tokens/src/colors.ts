/**
 * Paleta de TreoWallet. Los primeros siete colores vienen de treo.mx (kit global de Elementor y
 * variables del tema VamTam); el resto son extensiones para cumplir WCAG AA y para los estados que
 * Treo no define. Ningún componente usa la paleta directamente: solo los tokens semánticos.
 */
export const palette = {
  // treo.mx
  green900: '#1C4B42', // --vamtam-btn-bg-color
  lime400: '#B4E717', // --vamtam-btn-hover-bg-color
  ink: '#001A05', // vamtam_accent_1
  green500: '#31C454', // vamtam_accent_2: solo decorativo, 2.29:1 como texto
  green50: '#EDF7ED', // vamtam_accent_3
  sand50: '#F6F5F2', // fondo del megamenú
  white: '#FFFFFF', // vamtam_accent_5
  // Extensiones accesibles
  slate700: '#4B5A50', // reemplaza al #7E7E7E de Treo, que no llega a 4.5:1
  slate600: '#5F6B63',
  slate400: '#8A958D', // borde de campos, 3:1
  slate200: '#DCE2DE',
  success700: '#1E7B3A',
  warning700: '#8A5A00',
  warning50: '#FFF8E5',
  danger700: '#B42318',
  danger50: '#FEF3F2',
} as const;

export type PaletteColor = (typeof palette)[keyof typeof palette];

export interface StatusColors {
  fg: PaletteColor;
  bg: PaletteColor;
}

/** Forma de los colores semánticos que todo tema debe cumplir. */
export interface ThemeColors {
  surface: {
    default: PaletteColor;
    subtle: PaletteColor;
    brand: PaletteColor;
    inverse: PaletteColor;
  };
  text: {
    primary: PaletteColor;
    secondary: PaletteColor;
    muted: PaletteColor;
    disabled: PaletteColor;
    onAction: PaletteColor;
    onActionActive: PaletteColor;
    onInverse: PaletteColor;
  };
  action: { primary: PaletteColor; primaryActive: PaletteColor; disabled: PaletteColor };
  border: { default: PaletteColor; input: PaletteColor; focus: PaletteColor };
  accent: { brand: PaletteColor };
  status: {
    success: StatusColors;
    warning: StatusColors;
    danger: StatusColors;
    info: StatusColors;
    neutral: StatusColors;
  };
  money: { in: PaletteColor; out: PaletteColor };
}

export const lightColors = {
  surface: {
    default: palette.white,
    subtle: palette.sand50,
    brand: palette.green50,
    inverse: palette.green900,
  },
  text: {
    primary: palette.ink,
    secondary: palette.slate700,
    muted: palette.slate600,
    disabled: palette.slate700,
    onAction: palette.white,
    onActionActive: palette.green900,
    onInverse: palette.white,
  },
  action: {
    primary: palette.green900,
    primaryActive: palette.lime400,
    disabled: palette.slate200,
  },
  border: {
    default: palette.slate200,
    input: palette.slate400,
    focus: palette.green900,
  },
  accent: { brand: palette.green500 },
  status: {
    success: { fg: palette.success700, bg: palette.green50 },
    warning: { fg: palette.warning700, bg: palette.warning50 },
    danger: { fg: palette.danger700, bg: palette.danger50 },
    info: { fg: palette.green900, bg: palette.green50 },
    neutral: { fg: palette.slate700, bg: palette.sand50 },
  },
  money: { in: palette.success700, out: palette.ink },
} as const satisfies ThemeColors;
