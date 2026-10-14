import { StyleSheet, Text } from 'react-native';

import { theme } from '@/theme';

interface WordmarkProps {
  /** `inverse` para la superficie invertida (pantalla de privacidad). */
  tone?: 'default' | 'inverse';
  variant?: 'full' | 'compact';
}

/** Logotipo de texto "TreoWallet" (sin el logo de Treo): "Treo" en tinta y "Wallet" en verde. */
export function Wordmark({ tone = 'default', variant = 'full' }: WordmarkProps) {
  const inverse = tone === 'inverse';
  return (
    <Text
      accessibilityRole="header"
      accessibilityLabel="TreoWallet"
      style={[styles.base, variant === 'compact' && styles.compact]}
    >
      <Text style={{ color: inverse ? theme.colors.text.onInverse : theme.colors.text.primary }}>
        Treo
      </Text>
      <Text style={{ color: inverse ? theme.colors.text.onInverse : theme.colors.action.primary }}>
        Wallet
      </Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  base: { ...theme.typography.h1, fontFamily: theme.typography.display.fontFamily },
  compact: {
    fontSize: theme.typography.h3.fontSize,
    lineHeight: theme.typography.h3.lineHeight,
    letterSpacing: theme.typography.h3.letterSpacing,
  },
});
