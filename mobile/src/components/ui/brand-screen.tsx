import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/theme';

import { Wordmark } from './wordmark';

/** Pantallas públicas sobre la superficie de marca (MOB-22), como `BrandShell` de la web. */
export function BrandScreen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.brand}>
        <Wordmark tone="inverse" />
        <Text style={styles.tagline}>Tu billetera digital en pesos mexicanos.</Text>
      </View>
      <ScrollView
        style={styles.sheet}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.surface.hero },
  brand: {
    gap: theme.spacing[3],
    paddingHorizontal: theme.spacing[5],
    paddingTop: theme.spacing[16],
    paddingBottom: theme.spacing[8],
  },
  tagline: { ...theme.typography.body, color: theme.colors.text.onHeroMuted },
  sheet: {
    flex: 1,
    backgroundColor: theme.colors.surface.default,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
  },
  content: {
    gap: theme.spacing[6],
    paddingHorizontal: theme.spacing[5],
    paddingTop: theme.spacing[8],
    paddingBottom: theme.spacing[10],
  },
  title: { ...theme.typography.h1, color: theme.colors.text.primary },
});
