import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '@/theme';

import { IconButton } from './icon';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** Hoja inferior modal (DSG-17): misma anatomía que la de la web; atrás (Android) la cierra. */
export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const { bottom } = useSafeAreaInsets();
  return (
    <Modal
      testID="bottom-sheet-modal"
      visible={open}
      transparent
      statusBarTranslucent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable
          testID="bottom-sheet-backdrop"
          aria-hidden
          style={styles.backdrop}
          onPress={onClose}
        />
        <View
          testID="bottom-sheet"
          accessibilityViewIsModal
          style={[styles.sheet, { paddingBottom: theme.spacing[6] + bottom }]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            <IconButton icon="close" label="Cerrar" onPress={onClose} />
          </View>
          <ScrollView
            testID="bottom-sheet-body"
            bounces={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.body}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: theme.colors.surface.hero,
    opacity: 0.6,
  },
  sheet: {
    gap: theme.spacing[4],
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface.default,
    paddingHorizontal: theme.spacing[5],
    maxHeight: '85%',
    paddingTop: theme.spacing[3],
    ...theme.elevation.sheet,
  },
  handle: {
    alignSelf: 'center',
    width: theme.spacing[10],
    height: theme.spacing[1],
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.border.default,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing[4],
  },
  title: { ...theme.typography.h3, color: theme.colors.text.primary },
  body: { gap: theme.spacing[5] },
});
