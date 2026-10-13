import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

import { Button } from './button';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: { label: string; onPress: () => void };
}

/** Estado vacío: título, una línea de ayuda y una acción. */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <View style={styles.container}>
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
