/**
 * Tema para React Native: `import { theme } from '@devchrisvaz/wallet-design-tokens/native'`.
 * Usa los mismos tokens que la web, con valores numéricos y la familia de Work Sans por peso
 * (`@expo-google-fonts/work-sans`). No depende de `react-native`.
 */
import { themes } from './themes';
import {
  avatarSize,
  elevation,
  iconSize,
  layout,
  motion,
  nativeFontFamily,
  radius,
  spacing,
  touchTarget,
  typography,
} from './scale';
import type { TypographyStyle } from './scale';

export interface NativeTextStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
}

/**
 * Sin `fontWeight`: cada peso es su propia familia, y combinar una familia cargada a mano con
 * `fontWeight` hace que Android caiga en la fuente del sistema.
 */
const nativeTypography = Object.fromEntries(
  Object.entries(typography).map(([name, style]) => [
    name,
    {
      fontFamily: nativeFontFamily[style.fontWeight],
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing,
    },
  ]),
) as Record<TypographyStyle, NativeTextStyle>;

export const theme = {
  colors: themes.light.colors,
  typography: nativeTypography,
  /** Para cifras de montos: dígitos tabulares que se alinean en columnas. */
  amount: { fontVariant: ['tabular-nums'] as ['tabular-nums'] },
  spacing,
  radius,
  elevation: {
    card: elevation.card.native,
    raised: elevation.raised.native,
    sheet: elevation.sheet.native,
  },
  iconSize,
  avatarSize,
  layout,
  motion: { fast: motion.fast, base: motion.base },
  touchTarget,
} as const;

export type NativeTheme = typeof theme;
