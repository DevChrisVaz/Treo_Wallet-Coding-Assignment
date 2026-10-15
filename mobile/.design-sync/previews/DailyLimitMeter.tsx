import { DailyLimitMeter, ListSection, Text, View, theme } from 'wallet-mobile-ui';

// Lienzo de la app a ancho de teléfono; en Inicio el medidor va en su propia ListSection, sin título.
const frame = {
  width: 390,
  padding: theme.spacing[5],
  gap: theme.spacing[5],
  backgroundColor: theme.colors.surface.canvas,
};

const caption = { ...theme.typography.caption, color: theme.colors.text.muted };

// Límite diario de $50,000.00 (America/Mexico_City); `used` + `remaining` = `limit`.
export const Default = () => (
  <View style={frame}>
    <ListSection>
      <DailyLimitMeter dailyLimit={{ limit: '50000.00', used: '18500.00', remaining: '31500.00' }} />
    </ListSection>
  </View>
);

export const Unused = () => (
  <View style={frame}>
    <ListSection>
      <DailyLimitMeter dailyLimit={{ limit: '50000.00', used: '0.00', remaining: '50000.00' }} />
    </ListSection>
  </View>
);

export const NearlyReached = () => (
  <View style={frame}>
    <ListSection>
      <DailyLimitMeter dailyLimit={{ limit: '50000.00', used: '47250.00', remaining: '2750.00' }} />
    </ListSection>
  </View>
);

export const Reached = () => (
  <View style={frame}>
    <ListSection>
      <DailyLimitMeter dailyLimit={{ limit: '50000.00', used: '50000.00', remaining: '0.00' }} />
    </ListSection>
  </View>
);

export const UsageLevels = () => (
  <View style={frame}>
    <ListSection>
      <View style={{ gap: theme.spacing[5] }}>
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
          <DailyLimitMeter
            dailyLimit={{ limit: '50000.00', used: '47250.00', remaining: '2750.00' }}
          />
        </View>
        <View style={{ gap: theme.spacing[2] }}>
          <Text style={caption}>Agotado · 100%</Text>
          <DailyLimitMeter dailyLimit={{ limit: '50000.00', used: '50000.00', remaining: '0.00' }} />
        </View>
      </View>
    </ListSection>
  </View>
);
