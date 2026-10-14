import { navDestinations, type NavDestination } from '@devchrisvaz/wallet-design-tokens';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '@/theme';

import { Icon } from './icon';

interface TabBarProps {
  items: readonly NavDestination[];
  current: NavDestination | null;
  onSelect: (key: NavDestination) => void;
}

/** Barra de pestañas (MOB-18), con la misma anatomía que la de la web (DSG-17). */
export function TabBar({ items, current, onSelect }: TabBarProps) {
  const { bottom } = useSafeAreaInsets();
  return (
    <View
      testID="tab-bar"
      accessibilityRole="tablist"
      style={[styles.bar, { height: theme.layout.tabBarHeight + bottom, paddingBottom: bottom }]}
    >
      {items.map((key) => {
        const { label, icon } = navDestinations[key];
        const active = key === current;
        return (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(key)}
            style={styles.item}
          >
            <View style={[styles.pill, active && styles.pillActive]}>
              <Icon
                name={icon}
                size="lg"
                color={active ? theme.colors.accent.onDark : theme.colors.text.muted}
              />
            </View>
            <Text style={[styles.label, active ? styles.labelActive : null]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface.default,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.default,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[1],
  },
  pill: {
    width: theme.spacing[16],
    height: theme.spacing[8],
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: { backgroundColor: theme.colors.surface.hero },
  label: { ...theme.typography.caption, color: theme.colors.text.muted },
  labelActive: {
    fontFamily: theme.typography.label.fontFamily,
    color: theme.colors.action.primary,
  },
});
