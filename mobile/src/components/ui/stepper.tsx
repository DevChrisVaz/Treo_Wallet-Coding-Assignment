import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

/**
 * Indicador de pasos (MOB-21), como el de la web. El contenedor es el único elemento accesible: su
 * etiqueta se lee al enfocarlo y, como región viva, una sola vez cuando cambia el paso.
 */
export function Stepper({
  current,
  total,
  label,
}: {
  current: number;
  total: number;
  label: string;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`Paso ${current} de ${total}: ${label}`}
      accessibilityLiveRegion="polite"
      style={styles.container}
    >
      <View style={styles.bars}>
        {Array.from({ length: total }, (_, index) => (
          <View key={index} style={[styles.bar, index < current ? styles.done : null]} />
        ))}
      </View>
      <Text style={styles.text}>{`Paso ${current} de ${total} · ${label}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing[2] },
  bars: { flexDirection: 'row', gap: theme.spacing[1] },
  bar: {
    flex: 1,
    height: theme.spacing[1],
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.border.default,
  },
  done: { backgroundColor: theme.colors.action.primary },
  text: { ...theme.typography.caption, color: theme.colors.text.muted },
});
