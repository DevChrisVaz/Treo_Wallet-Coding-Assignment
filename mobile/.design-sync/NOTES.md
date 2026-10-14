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
  para que el agente componga pantallas, más las vistas reales de las pantallas (ver "Mapa de
  pantallas") y `ProblemError` del contrato. Las primitivas, `SafeAreaProvider`, las vistas y
  `ProblemError` están excluidas de las tarjetas con `componentSrcMap: null` (siguen en el bundle).
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

- Convención: cada historia va en el contexto del rediseño, `<View style={{ width: 390, padding:
  theme.spacing[5], gap: …, backgroundColor: theme.colors.surface.canvas }}>` (ancho de teléfono,
  margen de pantalla y lienzo de la app), y las tarjetas y listas van en `ListSection` donde las
  pantallas reales las ponen (el límite diario, los movimientos, el destinatario). Solo props `style`
  y `theme`; callbacks obligatorios con `noop`. Datos canónicos del rediseño (los de `Screen`) y
  textos reales (`problemMessage`, `transferStatus`, mensajes del contrato, copias de las vistas).
- `Select` abre un `Modal` de RN: el estado abierto no se captura dentro de una tarjeta. El contenido
  del modal se muestra en la historia `AccountSheet` de `OptionRow` (fondo inverse al 60 % y hoja
  anclada abajo, copiando los estilos de `select.tsx`).
- `Screen` necesita un padre con tamaño fijo (390x844); `PrivacyOverlay` es `position: absolute`,
  así que va en un padre con tamaño y `position: 'relative'`. Si se pone sobre contenido, se ve
  idéntico al Default (es opaco): por eso `AppSwitcherStates` muestra dos teléfonos lado a lado.
- `Skeleton` anima la opacidad; la captura puede caer a media animación (0.5–1). Es aceptable.
- Estados que no se capturan en estático: el `refresh` de `Screen` (RefreshControl), el Select
  abierto, foco y presión.
- `dtsPropsFor` (MovementRow, Receipt, DailyLimitMeter, PrivacyOverlay): el extractor no resuelve los
  tipos del contrato generados por openapi-typescript (`components["schemas"][…]`) y los deja como
  `unknown`. Los cuerpos están escritos a mano desde `contract/openapi.yaml` y las props del
  componente (Receipt incluye `fromAccountName` y `fromAccountClabe`, para el origen con su
  terminación).
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

Ninguno: el último validate (tarea 8.3) terminó limpio, 30/30 previews y "bundle is complete", con
los componentes en `cardMode: column` (el marco de 390 px de las previews es más ancho que una celda
de la grilla) salvo BottomSheet (`single`, 390x520). `[CSS_RUNTIME]` es informativo y esperado.

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

Cada pantalla y cada estado de pantalla completa es una historia de `Screen` en un marco de
**390x844** (el mismo de `initialMetrics`), con los mismos nombres que las historias de `AppShell` de
la web (el lienzo de paridad las empareja). Desde la tarea 8.1 las historias **dibujan las vistas
reales**: cada pantalla de la app es un contenedor (`*-screen.tsx`: expo-router, TanStack Query,
sesión) y una vista pura (`*-view.tsx`) que solo recibe props, y `entry.ts` exporta las vistas. Lo que
se ve en el lienzo es el código de presentación de la app con los datos canónicos, el mismo tema y
react-native-web.

| Vista real | Historias |
|---|---|
| `navigation/startup-views.tsx` | `StartupLoading`, `StartupOffline` |
| `features/auth/login-view.tsx` (sobre `BrandScreen`) | `Login`, `LoginRateLimited` |
| `features/accounts/home-view.tsx` | `Home`, `HomeEmpty`, `HomeLoading`, `HomeError`, `HomeUnlockOffer` (con `UnlockOfferView`) |
| `features/accounts/movements-view.tsx` | `Movements`, `MovementsEmpty` |
| `features/transfer/recipient-view.tsx` | `TransferRecipient`, `TransferRecipientEmpty` |
| `features/transfer/transfer-flow-view.tsx` (con `form-view`, `review-view`, `otp-view` y `outcome-view`) | `TransferAmount`, `TransferReview`, `TransferRetrying`, `TransferUncertain`, `TransferRejected`, `TransferOtp`, `TransferCompleted`, `TransferFailed`, `TransferOutcomeScheduled`, `TransferOutcomeCancelled` |
| `features/unlock/lock-screen-view.tsx` | `LockScreen`, `LockScreenLockout` |

- **La guarda de pureza.** `src/__tests__/views-are-pure.test.ts` falla si una vista importa
  navegación, consultas, sesión o módulos nativos (expo-*, TanStack Query, NetInfo, la sesión, las
  consultas, el intento de transferencia o, en el desbloqueo, la biometría y la preferencia) y lista
  las vistas que deben existir. Si una vista no se puede empaquetar con react-native-web, la guarda
  se saltó: se corrige el import de la vista, nunca la guarda.
- Las pestañas se ven con el `TabBar` del kit debajo de la vista, como lo monta el layout de
  pestañas de expo-router; el flujo de transferencia no lo lleva.
- `ActivityIndicator` se exporta en `entry.ts` (excluido de las tarjetas) para `StartupLoading`.
- Los textos de error salen de `errorMessage()` (`src/lib/errors.ts`) copiados en la historia. En
  `TransferOtp` el vencimiento es relativo al render (`Date.now()` + 4:32), así que la cuenta
  regresiva de la vista real arranca en 4:32 y la captura puede caer un segundo después.
- Omitidos a propósito (misma pantalla con otra alerta o botón `loading`): otros errores de login,
  loading/error de movimientos y del selector, `sending`, `rateLimited`, `error`, subestados del
  código, `expired`, `completed` repetido (`replayed`).
- Las historias ya no son copias del JSX: si una vista cambia, el lienzo cambia con ella. Lo que sí
  puede quedar desfasado son los datos canónicos y los estados que cada historia arma a mano.

## Revisión local

- `review/canvas.html` es el lienzo (pantallas primero, luego componentes por grupo). `package-build`
  vacía `ds-bundle/`: después de cada build corre `node .design-sync/review/install.mjs`.
- `web/.design-sync/review/serve.mjs` sirve ambos bundles en un solo origen (`/web/*`, `/mobile/*`)
  y el lienzo de paridad en `/parity.html`.

## Funciones propias de la app (bonus, P2)

Lo que llegó de `release` después de aprobar las historias es **función propia de cada
plataforma**: no tiene pareja web y queda "por diseño" en la paridad (ver la misma sección en
`web/.design-sync/NOTES.md`). Las historias usan las vistas reales con los datos canónicos.

| Función | Historias | Regla |
|---|---|---|
| Pantalla de bloqueo (MOB-25, MOB-26) | `Screen`: `LockScreen`, `LockScreenLockout`; `BrandScreen`: `Locked` | R46 |
| Oferta del desbloqueo en Inicio (MOB-24) | `Screen`: `HomeUnlockOffer` | R46 |
| Interruptor del desbloqueo en el menú de la cuenta (MOB-24, MOB-27) | `BottomSheet`: `AccountMenuUnlock`, `AccountMenuUnlockUnavailable` | R46 |
| Comprobante de una programada o cancelada (MOB-23) | `Screen`: `TransferOutcomeScheduled`, `TransferOutcomeCancelled`; `Receipt`: `Scheduled`, `Cancelled`; `StatusBadge`: `AllStatuses` | MOB-23 |

- **Vistas puras.** `features/unlock/{lock-screen,unlock-offer,unlock-switch}-view.tsx` dibujan; los
  contenedores (`lock-screen.tsx`, `unlock-offer.tsx`, `unlock-switch.tsx`) piden la biometría y
  guardan la preferencia. `entry.ts` exporta las tres vistas y `config.json` las deja sin tarjeta
  (`null`), como las demás vistas. `src/__tests__/views-are-pure.test.ts` las lista y además rechaza
  importar `./biometrics` o `./use-unlock-preference` en una vista.
- **El menú de la cuenta va en `BottomSheet`.** La hoja es un `Modal` de React Native: en el
  navegador se monta en `body` y en la tarjeta `column` de `Screen` taparía todas las historias. Por
  eso `AccountMenuUnlock` está junto a `AccountMenu`, en la tarjeta `single` de 390×520, con la vista
  real del interruptor. La hoja entra deslizándose: para capturarla a mano, espera ~1 s.
- **Interruptor en react-native-web.** En el teléfono `thumbColor` vale para los dos estados;
  react-native-web pinta el encendido con `activeThumbColor` (por omisión #009688, fuera de los
  tokens). La vista pasa también `activeThumbColor` con la superficie del tema.
- **Título del comprobante.** Con una transferencia `SCHEDULED` el paso se titula "Transferencia
  programada" (antes decía "Transferencia enviada" sobre la insignia "Programada"); con `CANCELLED`,
  "Estado de la transferencia". Son los títulos de la web.
- **Sin pareja a propósito.** Los nombres no coinciden con los de `AppShell` (`TransferOutcome*`
  frente a `TransferScheduled` de la web), así que `parity-check.mjs` no los compara. El comprobante
  móvil no lleva "Programada para": MOB-23 solo pide la etiqueta y el tono, y la app no programa.

## Subida a Claude Design

Pendiente: subir a Claude Design. Requiere autenticarse con `/design-login` (no se ha hecho en este entorno); después, `resync` desde cada app según 'Preparar'.
