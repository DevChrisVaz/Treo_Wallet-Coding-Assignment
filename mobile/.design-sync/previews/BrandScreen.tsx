import { BrandScreen, Button, InlineAlert, Text, TextField, View, theme } from 'wallet-mobile-ui';

const noop = () => {};

// Superficie de marca con la hoja blanca (MOB-22). Llena a su contenedor: marco de teléfono.
const phone = { width: 390, height: 844 };
const form = { gap: theme.spacing[4] };
const note = { ...theme.typography.caption, color: theme.colors.text.muted, textAlign: 'center' as const };

const fields = (
  <View style={form}>
    <TextField label="Correo" variant="email" value="" onChangeText={noop} />
    <TextField label="Contraseña" variant="password" value="" onChangeText={noop} />
    <Button label="Iniciar sesión" onPress={noop} />
  </View>
);

export const Login = () => (
  <View style={phone}>
    <BrandScreen title="Inicia sesión">
      {fields}
      <Text style={note}>
        ¿Aún no tienes cuenta? El registro y la verificación del correo se hacen en la web de
        TreoWallet.
      </Text>
    </BrandScreen>
  </View>
);

// Sesión revocada en otro dispositivo: el inicio de sesión abre con el aviso (SESSION_REVOKED).
export const SessionRevoked = () => (
  <View style={phone}>
    <BrandScreen title="Inicia sesión">
      <InlineAlert
        tone="warning"
        message="Cerramos tu sesión por seguridad. Inicia sesión de nuevo."
      />
      {fields}
    </BrandScreen>
  </View>
);
