import { theme } from '@devchrisvaz/wallet-design-tokens/native';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ApiUrlConfig } from './api-url';

interface ConfigGateProps {
  config: ApiUrlConfig;
  children: (baseUrl: string) => ReactNode;
}

/** Muestra la app solo con una URL de la API válida; si no, un error de configuración claro. */
export function ConfigGate({ config, children }: ConfigGateProps) {
  if (config.ok) return <>{children(config.baseUrl)}</>;

  const title =
    config.reason === 'missing' ? 'Falta configurar la API' : 'La URL de la API no es válida';
  return (
    <View style={styles.container} accessibilityRole="alert">
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {config.reason === 'invalid' ? (
        <Text style={styles.body}>{`Valor recibido: ${config.value}`}</Text>
      ) : null}
      <Text style={styles.body}>
        Define EXPO_PUBLIC_API_URL en mobile/.env con la IP de tu red local, por ejemplo
        http://192.168.1.50:4000 (en el emulador de Android, http://10.0.2.2:4000), y reinicia Expo.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    gap: theme.spacing[3],
    padding: theme.spacing[6],
    backgroundColor: theme.colors.surface.default,
  },
  title: { ...theme.typography.h2, color: theme.colors.status.danger.fg },
  body: { ...theme.typography.body, color: theme.colors.text.primary },
});
