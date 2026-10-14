import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

interface ListSectionProps {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
}

/** Tarjeta de lista con encabezado opcional (DSG-17), como la de la web. */
export function ListSection({ title, action, children }: ListSectionProps) {
  return (
    <View style={styles.card}>
      {title || action ? (
        <View style={styles.header}>
          {title ? (
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
          ) : (
            <View />
          )}
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface.default,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing[5],
    paddingVertical: theme.spacing[4],
    ...theme.elevation.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing[4],
    paddingBottom: theme.spacing[2],
  },
  title: { ...theme.typography.h3, color: theme.colors.text.primary },
});
