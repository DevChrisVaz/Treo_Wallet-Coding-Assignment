import { useEffect, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { useReducedMotion } from '@/lib/use-reduced-motion';
import { theme } from '@/theme';

/** Esqueleto de carga: pulsa salvo con movimiento reducido y está oculto a lectores de pantalla. */
export function Skeleton({ variant = 'line' }: { variant?: 'line' | 'card' }) {
  const reducedMotion = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (reducedMotion !== false) return undefined;
    // Un pulso lento a partir de la duración base del sistema.
    const duration = theme.motion.base * 4;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.5, duration, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [reducedMotion, opacity]);

  return (
    <Animated.View
      testID="skeleton"
      aria-hidden
      style={[styles.base, variant === 'card' ? styles.card : styles.line, { opacity }]}
    />
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: theme.colors.border.default },
  line: { height: theme.spacing[4], borderRadius: theme.radius.sm },
  card: { height: theme.spacing[16] * 2, borderRadius: theme.radius.md },
});
