import { formatMXN } from '@devchrisvaz/wallet-contract';
import { focusRing } from '@devchrisvaz/wallet-design-tokens';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { maskClabe } from '@/lib/display';
import { theme } from '@/theme';

interface AccountCardProps {
  name: string;
  clabe: string;
  balance: string;
  selected?: boolean;
  onPress?: () => void;
}

/** Cuenta con nombre, CLABE enmascarada y saldo en `display` con dígitos tabulares (DSG-09). */
export function AccountCard({ name, clabe, balance, selected = false, onPress }: AccountCardProps) {
  const formatted = formatMXN(balance);
  const content = (
    <>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.clabe}>{`CLABE ${maskClabe(clabe)}`}</Text>
      <Text style={styles.balance} adjustsFontSizeToFit numberOfLines={1}>
        {formatted}
      </Text>
    </>
  );
  const cardStyle = [styles.card, selected && styles.selected];

  if (!onPress) return <View style={cardStyle}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, CLABE terminación ${clabe.slice(-4)}, saldo ${formatted}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={cardStyle}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface.default,
    borderRadius: theme.radius.md,
    padding: theme.spacing[5],
    gap: theme.spacing[1],
    borderWidth: focusRing.width,
    borderColor: 'transparent',
    ...theme.elevation.card,
  },
  selected: { borderColor: theme.colors.border.focus },
  name: { ...theme.typography.label, color: theme.colors.text.primary },
  // Dígitos tabulares en la terminación de la CLABE, como en la web (DSG-09).
  clabe: { ...theme.typography.caption, ...theme.amount, color: theme.colors.text.secondary },
  balance: { ...theme.typography.h2, ...theme.amount, color: theme.colors.text.primary },
});
