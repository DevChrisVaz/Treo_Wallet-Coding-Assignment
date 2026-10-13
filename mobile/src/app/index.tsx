import { createApiClient, formatMXN } from '@devchrisvaz/wallet-contract';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

// Verificación de la tarea 1.2: Metro resuelve el cliente, formatMXN y el subpath ./native.
const api = createApiClient({ baseUrl: 'http://localhost:4000' });

export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        TreoWallet {formatMXN('1234567.89')} {typeof api.GET}
      </Text>
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
  text: { color: theme.colors.text.primary },
});
