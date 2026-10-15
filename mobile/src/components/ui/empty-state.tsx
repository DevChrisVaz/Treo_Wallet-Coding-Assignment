import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

import { Avatar } from './avatar';
import { Button } from './button';
import type { IconName } from './icon';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: { label: string; onPress: () => void };
  /** Icono en un avatar grande sobre el título. */
  icon?: IconName;
}

/** Estado vacío: título, una línea de ayuda y una acción. */
export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {icon ? <Avatar size="lg" icon={icon} /> : null}
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.description}>{description}</Text>
      {action ? <Button variant="secondary" label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface.default,
    borderRadius: theme.radius.lg,
    ...theme.elevation.card,
    gap: theme.spacing[3],
    paddingVertical: theme.spacing[10],
    paddingHorizontal: theme.spacing[6],
  },
  title: { ...theme.typography.h3, color: theme.colors.text.primary, textAlign: 'center' },
  description: {
    ...theme.typography.body,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
});
