import { StyleSheet, View } from 'react-native';

import { theme } from '@/theme';

import { Wordmark } from './wordmark';

/** Superficie invertida con el logotipo que tapa la app en segundo plano (D7, solo móvil). */
export function PrivacyOverlay() {
  return (
    <View testID="privacy-overlay" style={styles.overlay} accessibilityViewIsModal>
      <Wordmark tone="inverse" />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface.hero,
  },
});
