import type { Movement } from '@devchrisvaz/wallet-contract';
import { groupByDay } from '@devchrisvaz/wallet-design-tokens';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

import { MovementRow } from './movement-row';

/** Movimientos agrupados por día de Ciudad de México (MOB-20), como en la web. */
export function MovementList({ movements, now }: { movements: readonly Movement[]; now?: Date }) {
  return (
    <View style={styles.list}>
      {groupByDay(movements, (item) => item.occurredAt, now).map((group) => (
        <View key={group.key}>
          <Text accessibilityRole="header" style={styles.day}>
            {group.label}
          </Text>
          {group.items.map((item, index) => (
            <View key={item.id} style={index > 0 ? styles.divider : null}>
              <MovementRow movement={item} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: theme.spacing[2] },
  day: {
    ...theme.typography.caption,
    fontFamily: theme.typography.label.fontFamily,
    color: theme.colors.text.muted,
    paddingTop: theme.spacing[2],
    paddingBottom: theme.spacing[1],
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border.default,
  },
});
