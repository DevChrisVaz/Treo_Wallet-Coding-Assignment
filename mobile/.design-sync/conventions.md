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
- Diseña a ancho de teléfono (390 px). `Screen` llena a su contenedor (área segura, scroll y
  `footer` fijo abajo), así que dale un padre con tamaño: `<View style={{ width: 390, height: 844 }}>`.
- `Screen` es la raíz de cada pantalla, sobre el lienzo de la app (`surface.canvas`), con el margen
  de pantalla y 20 px entre sus secciones:
  - `header`: `AppHeader` en las pestañas (saludo "Hola, Ana" y el avatar del menú de la cuenta, o
    el título de la pestaña con `title`) o `FlowHeader` en el flujo de transferencia (cerrar, título
    del paso e indicador "Paso n de m").
  - `footer`: las acciones principales del paso, fijas abajo.
  - `tabBar`: en una pestaña; la barra (`TabBar` con Inicio, Movimientos y Transferir) va debajo de
    la pantalla, como hermana, y el flujo de transferencia no la lleva.
- Las pantallas públicas (inicio de sesión, bloqueo) van en `BrandScreen` (`title`, `children`):
  superficie de marca verde arriba con el Wordmark y hoja blanca abajo.

## Las pantallas de la app

Cada pantalla real es una historia de `Screen` (en `components/layout/Screen/`), en un marco de
390x844, dibujada con la vista real de la pantalla (los `*-view.tsx` de la app) y los datos
canónicos. Los nombres son los mismos que las historias de `AppShell` de la web:

| Pantalla | Historias |
|---|---|
| Arranque | `StartupLoading`, `StartupOffline` |
| Inicio de sesión (`BrandScreen`) | `Login`, `LoginRateLimited` |
| Inicio (pestaña) | `Home`, `HomeEmpty`, `HomeLoading`, `HomeError`, `HomeUnlockOffer` |
| Movimientos (pestaña) | `Movements`, `MovementsEmpty` |
| Transferir, paso a paso | `TransferRecipient` (o `TransferRecipientEmpty`) → `TransferAmount` → `TransferReview` (o `TransferRetrying` / `TransferUncertain` / `TransferRejected`) → `TransferOtp` → `TransferCompleted` (o `TransferFailed`) |
| Comprobante de una programada o cancelada en la web | `TransferOutcomeScheduled`, `TransferOutcomeCancelled` |
| Bloqueo biométrico (`BrandScreen`) | `LockScreen`, `LockScreenLockout` |

El menú de la cuenta (con "Cerrar sesión" y el interruptor del desbloqueo) es una hoja: está en las
historias de `BottomSheet` (`AccountMenu`, `AccountMenuUnlock`). Para rediseñar o crear una
pantalla, parte de la historia más cercana: trae la estructura, los textos y el pie de la app.

## Estilo: el objeto `theme` (tokens), nunca valores escritos a mano

- Colores (`theme.colors`): `surface.{canvas,default,subtle,brand,inverse,hero}` (`canvas` es el
  fondo de la app; `hero`, el del saldo y las pantallas de marca),
  `text.{primary,secondary,muted,disabled,onAction,onActionActive,onInverse,onHeroMuted}`,
  `action.{primary,primaryActive,disabled}`, `border.{default,input,focus}`,
  `accent.{brand,onDark}`, `status.{success,warning,danger,info,neutral}.{fg,bg}`, `money.{in,out}`.
  El lima `accent.onDark` va solo sobre `surface.hero`, nunca sobre superficies claras.
- Tipografía: esparce un estilo en `Text`, `{ ...theme.typography.h1, color: theme.colors.text.primary }`.
  Estilos: `displayXl` (el saldo del hero), `display`, `h1`, `h2`, `h3`, `body`, `bodySm`, `label`,
  `caption`. Cada uno trae la familia de Work Sans de su peso (`WorkSans_400Regular`,
  `WorkSans_500Medium`, `WorkSans_600SemiBold`); no pongas `fontWeight` suelto, porque cae a la
  fuente del sistema.
- Montos: agrega `...theme.amount` (dígitos tabulares). Entradas en `money.in` (verde), salidas en
  `money.out` (tinta, nunca rojo).
- Espaciado `theme.spacing[n]` con n en 0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16 (múltiplos de 4 px; el
  margen de pantalla y el espacio entre secciones es `spacing[5]`). Radios
  `theme.radius.{sm,md,lg,pill}` (tarjetas de cuenta `md`, hero, secciones y hojas `lg`, botones
  `pill`). Sombras `theme.elevation.{card,raised,sheet}`. Área táctil mínima `theme.touchTarget`
  (44). Iconos `theme.iconSize.{sm,md,lg}`, avatares `theme.avatarSize.{sm,md,lg}` y medidas de
  layout `theme.layout` (por ejemplo `tabBarHeight`).
- Una lista o un bloque de datos va en `ListSection` (tarjeta blanca con `title` y `action`
  opcionales); las listas de movimientos, en `MovementList`, que agrupa por día.

## Datos y textos

- Los montos van como string decimal con 2 decimales (`"25000.00"`, con signo en los movimientos:
  `"-1500.00"`); los componentes los formatean (`$25,000.00`). No formatees tú los montos que pasas.
- Las CLABE son de 18 dígitos y los componentes las enmascaran (`CLABE •••• 9719`).
- Fechas ISO 8601; se muestran en hora de Ciudad de México, y las listas se agrupan por día ("Hoy",
  "Ayer", "9 oct").
- Antes de usar un componente, lee `components/<grupo>/<Name>/<Name>.prompt.md` (ejemplos que
  renderizan) y `<Name>.d.ts` (sus props; `Movement`, `Transfer` y `DailyLimit` vienen escritos
  completos). Los callbacks obligatorios (`onPress`, `onChangeText`, `onChange`) siempre se pasan.

## Ejemplo: pantalla de inicio

```jsx
const {
  SafeAreaProvider, Screen, View, AppHeader, BalanceHero, QuickActions, AccountCard, ListSection,
  DailyLimitMeter, TabBar, theme,
} = window.TreoWalletMobile;
const noop = () => {};

<SafeAreaProvider>
  <View style={{ width: 390, height: 844 }}>
    <View style={{ flex: 1 }}>
      <Screen
        tabBar
        header={<AppHeader user={{ name: 'Ana Gómez Castillo', email: 'ana@example.com' }} onLogout={noop} />}
      >
        <BalanceHero
          total="35000.00"
          available="31500.00"
          actions={
            <QuickActions
              actions={[
                { key: 'transfer', label: 'Transferir', icon: 'transfer', onPress: noop },
                { key: 'movements', label: 'Movimientos', icon: 'movements', onPress: noop },
              ]}
            />
          }
        />
        <View style={{ gap: theme.spacing[3] }}>
          <AccountCard name="Principal" clabe="646180157000009719" balance="25000.00" selected onPress={noop} />
          <AccountCard name="Ahorro" clabe="646180157000001234" balance="10000.00" onPress={noop} />
        </View>
        <ListSection>
          <DailyLimitMeter dailyLimit={{ limit: '50000.00', used: '18500.00', remaining: '31500.00' }} />
        </ListSection>
      </Screen>
    </View>
    <TabBar items={['home', 'movements', 'transfer']} current="home" onSelect={noop} />
  </View>
</SafeAreaProvider>
```
