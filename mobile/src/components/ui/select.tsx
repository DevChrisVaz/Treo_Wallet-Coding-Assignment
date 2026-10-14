import { focusRing } from '@devchrisvaz/wallet-design-tokens';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

import { BottomSheet } from './bottom-sheet';
import { Icon } from './icon';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SelectProps {
  label: string;
  placeholder: string;
  options: SelectOption[];
  value: string | undefined;
  onChange: (value: string) => void;
  error?: string | undefined;
}

function optionName(option: SelectOption): string {
  return option.description ? `${option.label}, ${option.description}` : option.label;
}

interface OptionRowProps {
  option: SelectOption;
  selected?: boolean;
  onPress: () => void;
}

/** Opción de la lista del selector; también forma listas de elección a pantalla completa. */
export function OptionRow({ option, selected = false, onPress }: OptionRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={optionName(option)}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.option, (pressed || selected) && styles.optionActive]}
    >
      <Text style={styles.value}>{option.label}</Text>
      {option.description ? <Text style={styles.description}>{option.description}</Text> : null}
    </Pressable>
  );
}

/** Selector de cuenta o beneficiario: el campo abre la lista en una hoja inferior (DSG-11). */
export function Select({ label, placeholder, options, value, onChange, error }: SelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected ? optionName(selected) : placeholder}`}
        accessibilityHint={error}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={styles.wrapper}
      >
        <Text style={styles.label}>{label}</Text>
        <View style={[styles.field, error ? styles.fieldError : null]}>
          <View style={styles.text}>
            <Text style={selected ? styles.value : styles.placeholder}>
              {selected ? selected.label : placeholder}
            </Text>
            {selected?.description ? (
              <Text style={styles.description}>{selected.description}</Text>
            ) : null}
          </View>
          <Icon name="expand" color={theme.colors.text.secondary} />
        </View>
      </Pressable>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <BottomSheet open={open} onClose={() => setOpen(false)} title={label}>
        {options.map((option) => (
          <OptionRow
            key={option.value}
            option={option}
            selected={option.value === value}
            onPress={() => {
              onChange(option.value);
              setOpen(false);
            }}
          />
        ))}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing[1] },
  wrapper: { gap: theme.spacing[1] },
  label: { ...theme.typography.label, color: theme.colors.text.primary },
  // Mismo marco que `TextField` (52 px, radio `md`) para que los campos se vean iguales.
  field: {
    minHeight: theme.spacing[12] + theme.spacing[1],
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[2],
    borderWidth: 1,
    borderColor: theme.colors.border.input,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface.default,
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[2],
  },
  fieldError: { borderColor: theme.colors.status.danger.fg, borderWidth: focusRing.width },
  text: { flex: 1, gap: theme.spacing[1] },
  value: { ...theme.typography.body, color: theme.colors.text.primary },
  placeholder: { ...theme.typography.body, color: theme.colors.text.muted },
  description: { ...theme.typography.caption, color: theme.colors.text.secondary },
  error: { ...theme.typography.caption, color: theme.colors.status.danger.fg },
  option: {
    minHeight: theme.touchTarget,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[3],
    borderRadius: theme.radius.md,
  },
  optionActive: { backgroundColor: theme.colors.surface.brand },
});
