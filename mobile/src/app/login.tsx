import { StyleSheet, View } from 'react-native';

import { Wordmark } from '@/components/ui';
import { theme } from '@/theme';

/** Inicio de sesión (la pantalla completa llega con la tarea 3.1). */
export default function LoginRoute() {
  return (
    <View style={styles.container}>
      <Wordmark />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface.default,
  },
});
