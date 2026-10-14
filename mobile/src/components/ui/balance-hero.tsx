import { formatMXN } from '@devchrisvaz/wallet-contract';
import { heroAmountSize, splitCents } from '@devchrisvaz/wallet-design-tokens';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { theme } from '@/theme';

interface BalanceHeroProps {
  /** Saldo total en pesos como string decimal (`sumAmounts`). */
  total: string;
  /** Lo que queda del límite diario. */
  available: string;
  actions?: ReactNode;
}

/** Hero del saldo (MOB-19, DSG-13): igual que el de la web, con el resplandor lima en SVG. */
export function BalanceHero({ total, available, actions }: BalanceHeroProps) {
  const formatted = formatMXN(total);
  const [whole, cents] = splitCents(formatted);
  const amountStyle = theme.typography[heroAmountSize(formatted)];
  return (
    <View style={styles.hero}>
      {/* Decorativo: `aria-hidden` va en la View porque el Svg no lo traduce en nativo. */}
      <View testID="hero-glow" aria-hidden style={styles.glow}>
        <Svg width={theme.spacing[16] * 3} height={theme.spacing[16] * 3}>
          <Defs>
            <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={theme.colors.accent.onDark} stopOpacity={0.35} />
              <Stop offset="0.7" stopColor={theme.colors.accent.onDark} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle
            cx={theme.spacing[16] * 1.5}
            cy={theme.spacing[16] * 1.5}
            r={theme.spacing[16] * 1.5}
            fill="url(#glow)"
          />
        </Svg>
      </View>
      <View accessible accessibilityLabel={`Saldo total ${formatted}`}>
        <Text style={styles.title}>Saldo total</Text>
        <Text
          testID="hero-amount"
          numberOfLines={1}
          style={[amountStyle, theme.amount, styles.amount]}
        >
          {whole}
          <Text style={[theme.typography.h3, styles.amount]}>{cents}</Text>
        </Text>
      </View>
      <View style={styles.chip}>
        <Text style={styles.chipText}>{`Disponible hoy ${formatMXN(available)}`}</Text>
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    overflow: 'hidden',
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface.hero,
    padding: theme.spacing[6],
  },
  glow: { position: 'absolute', top: -theme.spacing[16], right: -theme.spacing[16] },
  title: { ...theme.typography.label, color: theme.colors.text.onHeroMuted },
  amount: { color: theme.colors.text.onInverse, marginTop: theme.spacing[1] },
  chip: {
    alignSelf: 'flex-start',
    marginTop: theme.spacing[3],
    minHeight: theme.spacing[6] + theme.spacing[1],
    justifyContent: 'center',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accent.onDark,
    paddingHorizontal: theme.spacing[3],
  },
  chipText: {
    ...theme.typography.caption,
    ...theme.amount,
    fontFamily: theme.typography.label.fontFamily,
    color: theme.colors.text.primary,
  },
  actions: { marginTop: theme.spacing[6] },
});
