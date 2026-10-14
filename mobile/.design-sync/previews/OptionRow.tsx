import { Button, IconButton, OptionRow, Text, View, theme } from 'wallet-mobile-ui';

const noop = () => {};

const frame = { width: 360, gap: theme.spacing[3], padding: theme.spacing[4] };

const luis = { value: 'luis', label: 'Luis', description: 'Luis Pérez · CLABE •••• 5678' };
const mama = { value: 'mama', label: 'Mamá', description: 'María Gómez · CLABE •••• 4321' };

export const Default = () => (
  <View style={frame}>
    <OptionRow option={luis} onPress={noop} />
  </View>
);

export const Selected = () => (
  <View style={frame}>
    <OptionRow option={luis} selected onPress={noop} />
  </View>
);

export const LabelOnly = () => (
  <View style={frame}>
    <OptionRow option={{ value: 'principal', label: 'Principal' }} onPress={noop} />
    <OptionRow option={{ value: 'ahorro', label: 'Ahorro' }} selected onPress={noop} />
  </View>
);

// Contenido de la hoja inferior que abre Select (la de BottomSheet: fondo verde al 60 %, asa,
// título con Cerrar). La hoja real es un Modal: ver la historia SourceAccount de BottomSheet.
export const AccountSheet = () => (
  <View
    style={{
      width: 360,
      minHeight: 340,
      justifyContent: 'flex-end',
      overflow: 'hidden',
      borderRadius: theme.radius.md,
    }}
  >
    <View
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor: theme.colors.surface.hero,
        opacity: 0.6,
      }}
    />
    <View
      style={{
        backgroundColor: theme.colors.surface.default,
        borderTopLeftRadius: theme.radius.lg,
        borderTopRightRadius: theme.radius.lg,
        paddingTop: theme.spacing[3],
        paddingHorizontal: theme.spacing[5],
        paddingBottom: theme.spacing[6],
        gap: theme.spacing[4],
        ...theme.elevation.sheet,
      }}
    >
      <View
        style={{
          alignSelf: 'center',
          width: theme.spacing[10],
          height: theme.spacing[1],
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.border.default,
        }}
      />
      <View
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary }}>
          Cuenta de origen
        </Text>
        <IconButton icon="close" label="Cerrar" onPress={noop} />
      </View>
      <View style={{ gap: theme.spacing[2] }}>
        <OptionRow
          option={{
            value: 'principal',
            label: 'Principal',
            description: 'CLABE •••• 9719 · $25,000.00',
          }}
          selected
          onPress={noop}
        />
        <OptionRow
          option={{ value: 'ahorro', label: 'Ahorro', description: 'CLABE •••• 1234 · $10,000.00' }}
          onPress={noop}
        />
      </View>
    </View>
  </View>
);

// Lista de elección a pantalla completa: "¿A quién le envías?".
export const BeneficiaryPicker = () => (
  <View style={{ ...frame, gap: theme.spacing[5] }}>
    <View style={{ gap: theme.spacing[1] }}>
      <Text style={{ ...theme.typography.label, color: theme.colors.text.secondary }}>
        Transferir
      </Text>
      <Text style={{ ...theme.typography.h1, color: theme.colors.text.primary }}>
        ¿A quién le envías?
      </Text>
    </View>
    <View style={{ gap: theme.spacing[2] }}>
      <OptionRow option={luis} onPress={noop} />
      <OptionRow option={mama} onPress={noop} />
    </View>
    <Button label="Cancelar" variant="ghost" onPress={noop} />
  </View>
);
