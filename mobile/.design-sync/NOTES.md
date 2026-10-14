# design-sync — mobile (TreoWallet Mobile)

Sincroniza el sistema de diseño de la app móvil con un proyecto de Claude Design. Todo se ejecuta
desde `mobile/`.

## Cómo está armado

- Claude Design renderiza React DOM en el navegador. `build-ui.mjs` (el `buildCmd`) compila los
  componentes reales de React Native con **react-native-web** (alias `react-native` →
  react-native-web, archivos `.web.*` primero, `__DEV__=false`), igual que Expo para web, en un
  paquete sintético `wallet-mobile-ui` en `.design-sync/.cache/pkg/` (gitignored): `dist/index.mjs`
  y `dist/types/**` (tsc de la app, TypeScript 6, con los `@/` reescritos a rutas relativas).
- react-native-web **no es dependencia de la app**: se instala solo en `.ds-sync/` con la versión
  que fija Expo (`expo/bundledNativeModules.json`, hoy `~0.21.0`). Si cambia el SDK de Expo, revisa
  esa versión.
- `entry.ts` es la lista explícita: `components/ui` (su index), `Screen`, el `theme` de tokens,
  `SafeAreaProvider` y las primitivas `View/Text/ScrollView/Pressable/StyleSheet/Image/TextInput`
  para que el agente componga pantallas. Las primitivas y `SafeAreaProvider` están excluidas de las
  tarjetas con `componentSrcMap: null` (siguen en el bundle).
- `provider`: `SafeAreaProvider` con `initialMetrics` fijos (390x844, insets 0). `Screen` y `Select`
  usan `SafeAreaView`, que lanza sin proveedor; en la app lo monta expo-router.
- Estilos: react-native-web los inyecta en tiempo de ejecución, así que `_ds_bundle.css` es un stub
  (`[CSS_RUNTIME]`, esperado). No hay clases CSS: se estiliza con props `style` y `theme`.
- Work Sans: el tema usa una familia por peso (`WorkSans_400Regular`, `_500Medium`,
  `_600SemiBold`, de `nativeFontFamily` en el paquete de tokens). `fonts.css` declara esas mismas
  familias con los `.ttf` de `@expo-google-fonts/work-sans` (`extraFonts`), que se copian a
  `fonts/`.
- Grupos: stubs `docs/<Name>.md` con frontmatter `category`.
- El `.d.ts` de TextField/AmountField incluye todas las props heredadas de `TextInput` (los tipos de
  React Native no se filtran como los del DOM). Es correcto, solo largo.

## Preparar (clon nuevo o scripts desactualizados)

```sh
SK=<carpeta del skill design-sync>
mkdir -p .ds-sync && cp -r "$SK"/package-build.mjs "$SK"/package-validate.mjs "$SK"/package-capture.mjs "$SK"/resync.mjs "$SK"/lib "$SK"/storybook .ds-sync/
echo '{"name":"ds-sync-deps","private":true}' > .ds-sync/package.json
(cd .ds-sync && npm i esbuild ts-morph @types/react@19.2 react-native-web@~0.21.0 react@19.2.3 react-dom@19.2.3 playwright@1.61.1)
npm ci
node .design-sync/build-ui.mjs
node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules ./node_modules --out ./ds-bundle
node .ds-sync/package-validate.mjs ./ds-bundle
```

- react y react-dom en `.ds-sync/` son las mismas versiones que la app (peers de
  react-native-web); el bundle los deja externos y usa los de `node_modules` de la app.
- playwright 1.61.1 fija chromium 1228 (el de `~/.cache/ms-playwright` en esta máquina).

## Previews (`previews/`, autoría propia)

- Convención: cada historia va en `<View style={{ width: 360, padding: theme.spacing[4], gap: … }}>`
  (ancho de teléfono), solo con props `style` y `theme`; callbacks obligatorios con `noop`. Datos de
  `src/test-utils/fixtures.ts` y textos reales (`problemMessage`, `transferStatus`, mensajes de
  `amountInput` del contrato, copias de las pantallas).
- `Select` abre un `Modal` de RN: el estado abierto no se captura dentro de una tarjeta. El contenido
  del modal se muestra en la historia `AccountSheet` de `OptionRow` (fondo inverse al 60 % y hoja
  anclada abajo, copiando los estilos de `select.tsx`).
- `Screen` necesita un padre con tamaño fijo (360x640); `PrivacyOverlay` es `position: absolute`,
  así que va en un padre con tamaño y `position: 'relative'`. Si se pone sobre contenido, se ve
  idéntico al Default (es opaco): por eso `AppSwitcherStates` muestra dos teléfonos lado a lado.
- `Skeleton` anima la opacidad; la captura puede caer a media animación (0.5–1). Es aceptable.
- Estados que no se capturan en estático: el `refresh` de `Screen` (RefreshControl), el Select
  abierto, foco y presión.
- `dtsPropsFor` (MovementRow, Receipt, DailyLimitMeter, PrivacyOverlay): el extractor no resuelve los
  tipos del contrato generados por openapi-typescript (`components["schemas"][…]`) y los deja como
  `unknown`. Los cuerpos están escritos a mano desde `contract/openapi.yaml`.
- Hallazgos de los tokens (no de las previews): los tonos success e info comparten fondo
  (`#EDF7ED`) y solo cambia el texto; la pista de `DailyLimitMeter` al 0 % (`#F6F5F2`) casi no se ve
  sobre blanco.
- El `.d.ts` de `Select` declara `value: string` obligatorio; el código acepta `undefined` (muestra el
  placeholder). Con `''` también se ve el placeholder.

## Header de convenciones

`conventions.md` (`readmeHeader`) va al inicio del README que lee el agente de diseño. Cada ruta del
`theme` y cada export que nombra se comprobó contra el paquete de tokens y el bundle; en cada
re-sync vuelve a validarlo y reporta lo que ya no exista (no lo reescribas sin preguntar).

## Known render warns

Ninguno: el último validate terminó limpio (17/17) con todos los componentes en `cardMode: column`
(el marco de 360 px de las previews es más ancho que una celda de la grilla). `[CSS_RUNTIME]` es
informativo y esperado.

## Re-sync risks

- react-native-web se instala aparte con la versión que fija Expo; al subir el SDK de Expo,
  revisa `expo/bundledNativeModules.json` y reinstala en `.ds-sync/`.
- `dtsPropsFor` copia a mano los tipos del contrato (Movement, Transfer, DailyLimit). Si
  `contract/openapi.yaml` cambia, actualízalos.
- `entry.ts` reexporta `@/components/ui` completo: un componente nuevo ahí entra solo, pero sin
  grupo (agrega su stub en `docs/`) y con tarjeta mínima hasta que tenga preview.
- `fonts.css` apunta a los `.ttf` de `node_modules/@expo-google-fonts/work-sans`: sin `npm ci` el
  build avisa `[FONT_MISSING]`.
- La historia `AccountSheet` de OptionRow copia los estilos del modal de `select.tsx`; si ese modal
  cambia, la preview queda desfasada sin que nada falle.
- Las grades viven en `.design-sync/.cache/review/` (gitignored); la verificación entre máquinas sale
  del `_ds_sync.json` subido al proyecto.

## Mapa de pantallas (`previews/Screen.tsx`)

Cada pantalla y cada estado de pantalla completa es una historia de Screen en un marco de
**390x844** (el mismo de `initialMetrics` y de `conventions.md`; a 360x640 quedaban bajo el pie las
acciones que distinguen varios estados). Portadas del JSX y StyleSheet reales (las pantallas usan
expo-router, TanStack Query y la sesión, no se pueden importar):

| Ruta / origen | Historias |
|---|---|
| `navigation/root-navigator.tsx` | `StartupLoading`, `StartupOffline` (sin `Screen`, como en la app) |
| `app/login.tsx` | `LoginScreen`, `LoginRateLimited` |
| `app/(app)/index.tsx` | `HomeScreen`, `HomeEmpty`, `HomeLoading`, `HomeError` |
| `app/(app)/accounts/[accountId].tsx` | `MovementsScreen`, `MovementsEmpty` |
| `app/(app)/transfer/index.tsx` | `BeneficiaryPickerScreen`, `BeneficiaryPickerEmpty` |
| `app/(app)/transfer/send.tsx` | `TransferFormScreen`, `TransferReviewScreen`, `TransferRetryingScreen`, `TransferUncertainScreen`, `TransferRejectedScreen`, `TransferOtpScreen`, `TransferCompletedScreen`, `TransferFailedScreen` |

- `ActivityIndicator` se exporta en `entry.ts` (excluido de las tarjetas) para `StartupLoading`.
- Montos y textos de error van escritos a mano (la preview no importa el contrato ni los tokens);
  "El código vence en 4:32." es fijo (en la app es una cuenta regresiva).
- Omitidos a propósito (misma pantalla con otra alerta o botón `loading`): otros errores de login,
  loading/error de movimientos y del selector, `sending`, `rateLimited`, `error`, subestados del
  código, `expired`, `completed` repetido (`replayed`).
- Si una pantalla de la app cambia, su historia queda desfasada sin que nada falle: es una copia
  del JSX. Revísalas en cada re-sync contra `src/features/` y `src/navigation/root-navigator.tsx`.

## Revisión local

- `review/canvas.html` es el lienzo (pantallas primero, luego componentes por grupo). `package-build`
  vacía `ds-bundle/`: después de cada build corre `node .design-sync/review/install.mjs`.
- `web/.design-sync/review/serve.mjs` sirve ambos bundles en un solo origen (`/web/*`, `/mobile/*`)
  y el lienzo de paridad en `/parity.html`.
