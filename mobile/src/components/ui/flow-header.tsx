import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

import { IconButton } from './icon';
import { Stepper } from './stepper';

interface FlowHeaderProps {
  title: string;
  step: number;
  total: number;
  stepLabel: string;
  onClose: () => void;
}

/** Encabezado del flujo de transferencia: cerrar, título y pasos (MOB-21). */
export function FlowHeader({ title, step, total, stepLabel, onClose }: FlowHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.row}>
        <View style={styles.close}>
          <IconButton icon="close" label="Salir de la transferencia" onPress={onClose} />
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
      </View>
      <Stepper current={step} total={total} label={stepLabel} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: theme.spacing[4],
    paddingHorizontal: theme.spacing[5],
    paddingTop: theme.spacing[4],
    paddingBottom: theme.spacing[2],
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
  close: { marginLeft: -theme.spacing[3] },
  title: { ...theme.typography.h3, color: theme.colors.text.primary },
});
