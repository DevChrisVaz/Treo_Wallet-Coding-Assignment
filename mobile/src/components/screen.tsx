import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/theme';

interface ScreenProps {
  children: ReactNode;
  /** Deslizar hacia abajo para actualizar. */
  refresh?: { refreshing: boolean; onRefresh: () => void };
  footer?: ReactNode;
  /** Encabezado fijo sobre el contenido desplazable. */
  header?: ReactNode;
  /** Hay barra de pestañas: el contenido reserva su alto para no quedar tapado. */
  tabBar?: boolean;
}

/** Contenedor de pantalla: área segura, desplazamiento, teclado y margen del sistema. */
export function Screen({ children, refresh, footer, header, tabBar = false }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {header}
        <ScrollView
          testID="screen-scroll"
          contentContainerStyle={[
            styles.content,
            tabBar ? { paddingBottom: theme.layout.tabBarHeight + theme.spacing[6] } : null,
          ]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            refresh ? (
              <RefreshControl
                refreshing={refresh.refreshing}
                onRefresh={refresh.onRefresh}
                tintColor={theme.colors.action.primary}
                colors={[theme.colors.action.primary]}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.surface.canvas },
  flex: { flex: 1 },
  content: { padding: theme.spacing[5], gap: theme.spacing[5], flexGrow: 1 },
  footer: {
    paddingHorizontal: theme.spacing[5],
    paddingVertical: theme.spacing[4],
    gap: theme.spacing[3],
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.default,
  },
});
