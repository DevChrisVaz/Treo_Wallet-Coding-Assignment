import { lightColors, type ThemeColors } from './colors';

export interface Theme {
  name: string;
  colors: ThemeColors;
}

/**
 * Temas disponibles. Solo se entrega el claro; un tema oscuro sería otra entrada con los mismos
 * tokens semánticos y otros valores, sin cambiar ningún componente.
 */
export const themes = {
  light: { name: 'light', colors: lightColors },
} as const satisfies Record<string, Theme>;

export type ThemeName = keyof typeof themes;

/** Tema por defecto. */
export const theme = themes.light;
