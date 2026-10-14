# TreoWallet Mobile — convenciones para diseñar con este sistema

Billetera digital en pesos mexicanos (app Expo + React Native). Todo el texto de la interfaz va en
español de México. Los componentes son los de React Native de la app, compilados para el navegador
con react-native-web: se diseña con **primitivas de React Native y estilos en objeto, nunca con HTML
ni clases CSS** (no existe ninguna clase).

## Montaje

Todo está en `window.TreoWalletMobile`: los componentes, las primitivas `View`, `Text`,
`ScrollView`, `Pressable`, `StyleSheet`, `Image`, `TextInput`, el objeto `theme` y
`SafeAreaProvider`.

- Envuelve cada pantalla en `SafeAreaProvider`: `Screen` y `Select` lanzan un error sin él.
- Diseña a ancho de teléfono (360–390 px). `Screen` llena a su contenedor (área segura, scroll y
  `footer` fijo abajo), así que dale un padre con tamaño: `<View style={{ width: 390, height: 844 }}>`.
- Usa `Screen` como raíz de cada pantalla y pon las acciones principales en su `footer`.

## Las pantallas de la app

Cada pantalla real está como historia de `Screen` (en `components/layout/Screen/`), en un marco
de 390x844: `StartupLoading`, `StartupOffline`, `LoginScreen`, `LoginRateLimited`, `HomeScreen`,
`HomeEmpty`, `HomeLoading`, `HomeError`, `MovementsScreen`, `MovementsEmpty`,
`BeneficiaryPickerScreen`, `BeneficiaryPickerEmpty` y el flujo de transferencia
`TransferFormScreen` → `TransferReviewScreen` (o `TransferRetryingScreen` /
`TransferUncertainScreen` / `TransferRejectedScreen`) → `TransferOtpScreen` →
`TransferCompletedScreen` (o `TransferFailedScreen`). Para rediseñar o crear una pantalla, parte de
la historia más cercana: trae la estructura, los textos y el pie de la app.

## Estilo: el objeto `theme` (tokens), nunca valores escritos a mano

- Colores (`theme.colors`): `surface.{default,subtle,brand,inverse}`,
  `text.{primary,secondary,muted,disabled,onAction,onActionActive,onInverse}`,
  `action.{primary,primaryActive,disabled}`, `border.{default,input,focus}`, `accent.brand`,
  `status.{success,warning,danger,info,neutral}.{fg,bg}`, `money.{in,out}`.
- Tipografía: esparce un estilo en `Text`, `{ ...theme.typography.h1, color: theme.colors.text.primary }`.
  Estilos: `display`, `h1`, `h2`, `h3`, `body`, `bodySm`, `label`, `caption`. Cada uno trae la
  familia de Work Sans de su peso (`WorkSans_400Regular`, `WorkSans_500Medium`,
  `WorkSans_600SemiBold`); no pongas `fontWeight` suelto, porque cae a la fuente del sistema.
- Montos: agrega `...theme.amount` (dígitos tabulares). Entradas en `money.in` (verde), salidas en
  `money.out` (tinta, nunca rojo).
- Espaciado `theme.spacing[n]` con n en 0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16 (múltiplos de 4 px; el
  margen de pantalla es `spacing[5]`). Radios `theme.radius.{sm,md,lg,pill}` (tarjetas `md`,
  botones `pill`). Sombra `theme.elevation.card`. Área táctil mínima `theme.touchTarget` (44).

## Datos y textos

- Los montos van como string decimal con 2 decimales (`"25000.00"`, con signo en los movimientos:
  `"-1500.00"`); los componentes los formatean (`$25,000.00`). No formatees tú los montos que pasas.
- Las CLABE son de 18 dígitos y los componentes las enmascaran (`CLABE •••• 9719`).
- Fechas ISO 8601; se muestran en hora de Ciudad de México.
- Antes de usar un componente, lee `components/<grupo>/<Name>/<Name>.prompt.md` (ejemplos que
  renderizan) y `<Name>.d.ts` (sus props; `Movement`, `Transfer` y `DailyLimit` vienen escritos
  completos). Los callbacks obligatorios (`onPress`, `onChangeText`, `onChange`) siempre se pasan.

## Ejemplo: pantalla de inicio

```jsx
const { SafeAreaProvider, Screen, View, Text, Wordmark, DailyLimitMeter, AccountCard, Button, theme } =
  window.TreoWalletMobile;

<SafeAreaProvider>
  <View style={{ width: 390, height: 844 }}>
    <Screen
      footer={
        <>
          <Button label="Transferir" onPress={() => {}} />
          <Button label="Cerrar sesión" variant="ghost" onPress={() => {}} />
        </>
      }
    >
      <View style={{ gap: theme.spacing[2] }}>
        <Wordmark variant="compact" />
        <Text style={{ ...theme.typography.h1, color: theme.colors.text.primary }}>Tus cuentas</Text>
      </View>
      <View style={{ gap: theme.spacing[4] }}>
        <DailyLimitMeter dailyLimit={{ limit: '50000.00', used: '18500.00', remaining: '31500.00' }} />
        <AccountCard name="Principal" clabe="646180157000009719" balance="25000.00" onPress={() => {}} />
        <AccountCard name="Ahorro" clabe="646180157000001234" balance="10000.00" onPress={() => {}} />
      </View>
    </Screen>
  </View>
</SafeAreaProvider>
```
