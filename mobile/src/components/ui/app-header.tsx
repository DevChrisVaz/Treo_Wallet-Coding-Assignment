import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

import { Avatar, initials } from './avatar';
import { BottomSheet } from './bottom-sheet';
import { Button } from './button';

interface AppHeaderProps {
  user: { name: string; email: string };
  /** Título de la pestaña; sin él, saluda con el nombre (Inicio). */
  title?: string;
  onLogout?: () => void;
}

/** Encabezado de la app (MOB-18): saludo o título y el menú de la cuenta. */
export function AppHeader({ user, title, onLogout }: AppHeaderProps) {
  const [open, setOpen] = useState(false);
  const firstName = user.name.trim().split(/\s+/)[0] ?? user.name;
  return (
    <View style={styles.header}>
      {title ? (
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
      ) : (
        // El saludo es el encabezado de Inicio: se anuncia como uno solo, "Hola, Ana".
        <View accessible accessibilityRole="header" accessibilityLabel={`Hola, ${firstName}`}>
          <Text style={styles.hello}>Hola,</Text>
          <Text style={styles.title}>{firstName}</Text>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Menú de la cuenta"
        onPress={() => setOpen(true)}
        style={styles.menuButton}
      >
        <Avatar tone="hero" initials={initials(user.name)} />
      </Pressable>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Tu cuenta">
        <View style={styles.account}>
          <Avatar tone="brand" initials={initials(user.name)} />
          <View style={styles.accountText}>
            <Text style={styles.name} numberOfLines={1}>
              {user.name}
            </Text>
            <Text style={styles.email} numberOfLines={1}>
              {user.email}
            </Text>
          </View>
        </View>
        {onLogout ? (
          <Button label="Cerrar sesión" icon="logout" variant="secondary" onPress={onLogout} />
        ) : null}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing[4],
    paddingHorizontal: theme.spacing[5],
    paddingTop: theme.spacing[6],
    paddingBottom: theme.spacing[4],
  },
  hello: { ...theme.typography.bodySm, color: theme.colors.text.secondary },
  title: { ...theme.typography.h2, color: theme.colors.text.primary },
  menuButton: {
    width: theme.touchTarget,
    height: theme.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.pill,
  },
  account: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] },
  accountText: { flex: 1, minWidth: 0 },
  name: { ...theme.typography.label, color: theme.colors.text.primary },
  email: { ...theme.typography.caption, color: theme.colors.text.muted },
});
