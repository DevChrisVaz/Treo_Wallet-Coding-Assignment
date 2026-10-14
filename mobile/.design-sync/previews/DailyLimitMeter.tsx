import { AccountCard, DailyLimitMeter, Text, View, theme } from 'wallet-mobile-ui';

const noop = () => {};

const frame = { width: 360, padding: theme.spacing[4], gap: theme.spacing[3] };

const caption = { ...theme.typography.caption, color: theme.colors.text.muted };

// Límite diario de $50,000.00 (America/Mexico_City); `used` + `remaining` = `limit`.
export const Default = () => (
  <View style={frame}>
    <DailyLimitMeter dailyLimit={{ limit: '50000.00', used: '18500.00', remaining: '31500.00' }} />
  </View>
);

export const Unused = () => (
  <View style={frame}>
    <DailyLimitMeter dailyLimit={{ limit: '50000.00', used: '0.00', remaining: '50000.00' }} />
  </View>
);

export const NearlyReached = () => (
  <View style={frame}>
    <DailyLimitMeter dailyLimit={{ limit: '50000.00', used: '47250.00', remaining: '2750.00' }} />
  </View>
);

export const Reached = () => (
  <View style={frame}>
    <DailyLimitMeter dailyLimit={{ limit: '50000.00', used: '50000.00', remaining: '0.00' }} />
  </View>
);

export const UsageLevels = () => (
  <View style={{ ...frame, gap: theme.spacing[5] }}>
    <View style={{ gap: theme.spacing[2] }}>
      <Text style={caption}>Sin usar · 0%</Text>
      <DailyLimitMeter dailyLimit={{ limit: '50000.00', used: '0.00', remaining: '50000.00' }} />
    </View>
    <View style={{ gap: theme.spacing[2] }}>
      <Text style={caption}>A la mitad · 50%</Text>
      <DailyLimitMeter
        dailyLimit={{ limit: '50000.00', used: '25000.00', remaining: '25000.00' }}
      />
    </View>
    <View style={{ gap: theme.spacing[2] }}>
      <Text style={caption}>Casi agotado · 94%</Text>
      <DailyLimitMeter dailyLimit={{ limit: '50000.00', used: '47250.00', remaining: '2750.00' }} />
    </View>
    <View style={{ gap: theme.spacing[2] }}>
      <Text style={caption}>Agotado · 100%</Text>
      <DailyLimitMeter dailyLimit={{ limit: '50000.00', used: '50000.00', remaining: '0.00' }} />
    </View>
  </View>
);

export const AboveAccounts = () => (
  <View style={{ ...frame, gap: theme.spacing[4] }}>
    <DailyLimitMeter dailyLimit={{ limit: '50000.00', used: '18500.00', remaining: '31500.00' }} />
    <AccountCard name="Principal" clabe="646180157000009719" balance="25000.00" onPress={noop} />
  </View>
);
