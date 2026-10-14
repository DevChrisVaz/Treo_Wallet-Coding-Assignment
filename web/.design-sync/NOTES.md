# design-sync — web (TreoWallet Web)

Sincroniza el sistema de diseño de la web con un proyecto de Claude Design. Todo se ejecuta desde `web/`.

## Cómo está armado

- La app no publica un paquete ni tiene Storybook. `build-ui.mjs` (el `buildCmd`) arma un paquete
  sintético `wallet-web-ui` en `.design-sync/.cache/pkg/` (gitignored): `dist/index.mjs` (esbuild
  sobre `entry.ts`, alias `@/` del tsconfig, React externo), `dist/types/**` (tsc de la app con
  `emitDeclarationOnly`; los `@/` se reescriben a rutas relativas) y `dist/styles.css`.
- `entry.ts` es la lista explícita de lo que se sincroniza: components/ui + LoadingState/ErrorState,
  PageShell y StepHeading. Agregar un componente = exportarlo ahí (y su grupo en `docs/`).
- `dist/styles.css` es `app/globals.css` compilado con `@tailwindcss/postcss` de la app
  (`tailwind.css` es la entrada). Es estático: solo existen las clases que aparecen en la app, en
  `previews/` o en los `@source inline(...)` de `tailwind.css` (el vocabulario que puede usar el
  agente de diseño). **Si una preview usa una clase nueva, vuelve a correr `buildCmd` antes de
  `package-build.mjs`**; `preview-rebuild.mjs` no recompila el CSS.
- Work Sans: la app la sirve con `next/font/google`; aquí entra por `@import url(Google Fonts)` en
  `tailwind.css` (validate imprime `[FONT_REMOTE]`, es lo esperado) y `--font-work-sans` se define
  en `:root`, porque `globals.css` arma `--dt-font-sans` con esa variable.
- Grupos: los componentes de `components/ui` caen en `general`; los stubs `docs/<Name>.md` (solo
  frontmatter `category`) los reparten en Actions/Forms/Feedback/Wallet/Brand. Los que viven en
  otras carpetas toman el grupo de la carpeta (states, layout, transfers): el `category` del doc
  solo aplica cuando el grupo de la carpeta es genérico.
- `tokensPkg` va explícito: con un nombre de paquete sin scope no se autodetecta
  `@devchrisvaz/wallet-design-tokens`. `tokensGlob` copia solo `generated/tokens.css` (el
  `tailwind.css` del paquete trae `@theme`, que no es CSS de navegador).
- Los `.d.ts` emitidos filtran las props nativas heredadas (onClick, disabled, value, onChange…);
  los componentes sí las aceptan y las pasan al elemento. El header de convenciones lo dice.

## Preparar (clon nuevo o scripts desactualizados)

```sh
SK=<carpeta del skill design-sync>
mkdir -p .ds-sync && cp -r "$SK"/package-build.mjs "$SK"/package-validate.mjs "$SK"/package-capture.mjs "$SK"/resync.mjs "$SK"/lib "$SK"/storybook .ds-sync/
echo '{"name":"ds-sync-deps","private":true}' > .ds-sync/package.json
(cd .ds-sync && npm i esbuild ts-morph @types/react@19.3 playwright@1.61.1 pixelmatch@7 pngjs@7)
npm ci   # dependencias de la app (typescript, postcss, @tailwindcss/postcss)
node .design-sync/build-ui.mjs
node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules ./node_modules --out ./ds-bundle
node .ds-sync/package-validate.mjs ./ds-bundle
```

- playwright 1.61.1 fija chromium 1228, el que está en `~/.cache/ms-playwright` de esta máquina.
  Con otro chromium en caché, instala la versión de playwright cuyo `browsers.json` lo fije.
- No hace falta `--entry`: `config.json` lo trae (`entry`, relativo a `web/`).

## Previews (`previews/`, autoría propia)

- Datos de `test/fixtures.ts` y textos reales de las pantallas (TransferForm, OtpStep,
  ConfirmStep, LoginForm, VerifyEmailForm, BeneficiariesScreen, MovementsScreen,
  AccountsOverviewScreen), de `transferStatus`/`problemMessages` del paquete de tokens y de los
  mensajes de validación del contrato.
- Antes de usar una clase en una preview, comprueba que exista en `.cache/pkg/dist/styles.css`
  (`grep -F '.max-w-md' …`). Si no existe, agrégala al safelist de `tailwind.css` y corre `buildCmd`.
- El viewport de captura es de 900 px, así que aplican los breakpoints `sm:`. Por eso AccountCard
  (usa `sm:grid-cols-2`) y PageShell (encabezado a todo lo ancho) van en `cardMode: column`.
- `StepHeading` se enfoca al montarse: en las previews va con `focus={false}` para no robar el foco
  ni desplazar el lienzo. Por lo mismo, no se usa `focusOnMount` de InlineAlert.
- `ErrorState` pasa `error` por `describeError`, que solo da mensajes por `code` con una instancia
  de `ProblemError` (no se exporta en `entry.ts`). Las previews usan `new TypeError('Failed to
  fetch')`, que muestra el mensaje de conexión. Para previsualizar mensajes por código habría que
  reexportar `ProblemError` desde `entry.ts` (y excluirlo de las tarjetas con `componentSrcMap`).
- `PageShell` recibe la navegación como `actions`: AppNav y LogoutButton no están en el bundle
  (dependen de next/navigation y react-query); las previews los rearman con las clases de AppHeader.
- `rounded-sm` se emite después de `rounded-pill`: un `className` no puede cambiar el radio que el
  componente ya trae (por ejemplo, Skeleton).
- `dtsPropsFor` (MovementRow, Receipt, AccountCard, DailyLimitMeter): el extractor no resuelve los
  tipos del contrato generados por openapi-typescript (`components["schemas"][…]`) y los deja como
  `unknown`. Los cuerpos están escritos a mano desde `contract/openapi.yaml`.
- Estados que no se capturan en estático: la CLABE completa de AccountCard ("Mostrar CLABE"), el foco
  del SkipLink, el select nativo abierto, escribir/pegar el código, la animación de los esqueletos.
- Hallazgos de los tokens (no de las previews): `info-soft` y `success-soft` comparten `#EDF7ED`; la
  pista vacía de DailyLimitMeter (`bg-neutral-soft`) casi no se ve sobre blanco.

## Header de convenciones

`conventions.md` (`readmeHeader`) va al inicio del README que lee el agente de diseño. Cada clase,
token y export que nombra se comprobó contra `_ds_bundle.css`, `tokens/tokens.css` y el bundle; en
cada re-sync vuelve a validarlo y reporta lo que ya no exista (no lo reescribas sin preguntar).

## Known render warns

Ninguno: el último validate terminó limpio (18/18). `[FONT_REMOTE]` es informativo y esperado.

## Re-sync risks

- `dtsPropsFor` copia a mano los tipos del contrato (Movement, Transfer, Account, DailyLimit). Si
  `contract/openapi.yaml` cambia (nuevo estado, campos o motivos), actualízalos.
- `entry.ts` es una lista explícita: un componente nuevo en `components/ui` no se sincroniza hasta
  que se exporte ahí y tenga su stub en `docs/`.
- El CSS sale de `app/globals.css` + el safelist de `tailwind.css`: si la app cambia de tokens o de
  versión de Tailwind, revisa que el safelist siga generando las familias del header.
- Work Sans se carga en tiempo de ejecución desde Google Fonts (red); no hay archivos locales.
- Las previews de PageShell rearman AppNav con las clases de `components/layout/AppHeader.tsx`;
  si ese encabezado cambia, las previews quedan desfasadas sin que nada falle.
- Las grades viven en `.design-sync/.cache/review/` (gitignored); la verificación entre máquinas sale
  del `_ds_sync.json` subido al proyecto.

## Mapa de pantallas (`previews/PageShell.tsx`)

Cada ruta y cada estado de página completo es una historia de PageShell, portada del JSX real de
la pantalla (no se pueden importar: usan Server Actions, TanStack Query y next/navigation):

| Ruta | Historias |
|---|---|
| `/login`, `/register`, `/verify-email` | `LoginPage`, `RegisterPage`, `VerifyEmailPage` |
| `/` | `AccountsPage`, `AccountsEmpty` |
| `/accounts/[id]/movements` | `MovementsPage`, `MovementsEmpty` |
| `/beneficiaries`, `/beneficiaries/new` | `BeneficiariesPage`, `BeneficiariesEmpty`, `NewBeneficiaryPage` |
| `/transfers/new` (TransferFlow) | `TransferFormPage`, `TransferConfirmPage`, `TransferInsufficientFundsPage`, `TransferUncertainPage`, `TransferOtpPage`, `TransferReceiptPage`, `TransferRejectedPage` |
| `/transfers/[id]` | `TransferDetailPage` |

- La navegación (AppNav + "Cerrar sesión") se rearma con las clases de `AppHeader.tsx`; el ítem
  actual sigue `isCurrent()` (en `/transfers/[id]` no hay ítem actual, igual que en la app).
- Montos, CLABE enmascaradas y la hora de vencimiento del código van ya formateados: `formatMXN`,
  `maskClabe` y `formatTime` no se exportan en `wallet-web-ui`.
- Omitidos a propósito (variantes de una sola alerta o ya cubiertos por previews de componentes):
  loading/error de cada pantalla, `/login?reason=expired`, subestados del código (entrega fallida,
  reenviado, código inválido), `/transfers/[id]` en PENDING_OTP, errores de validación por campo.
- Las celdas de la hoja de revisión se recortan a 900x700; las páginas más altas se verificaron
  con capturas de página completa. Los `type="date"` muestran `mm/dd/yyyy` por el locale del
  navegador de captura (en es-MX la app muestra `dd/mm/aaaa`).
- Si una pantalla de la app cambia, su historia queda desfasada sin que nada falle: es una copia
  del JSX. Revísalas en cada re-sync contra `components/{auth,accounts,beneficiaries,transfers}/`.

## Revisión local

- `review/canvas.html` es el lienzo (pantallas primero, luego componentes por grupo). `package-build`
  vacía `ds-bundle/`: después de cada build corre `node .design-sync/review/install.mjs`.
- `web/.design-sync/review/serve.mjs` sirve ambos bundles en un solo origen (`/web/*`, `/mobile/*`)
  y el lienzo de paridad en `/parity.html`.

## Paridad

`review/parity.html` (lienzo) y `review/parity-check.mjs` (medición) comparan cada pareja de
historias con el mismo nombre en `AppShell` (web) y `Screen` (móvil), WEB-25 / D3.

- Con el servidor de revisión arriba (`node web/.design-sync/review/serve.mjs --web web/ds-bundle
  --mobile mobile/ds-bundle --port 4310`, desde la raíz del worktree), el lienzo está en
  `http://127.0.0.1:4310/parity.html`: por pareja, la web a 1280×800, la móvil a 390×844 con la web
  encima (al 50 % con "Superponer") y la web a 390×844. Las historias de una sola app van con sus
  marcos.
- La medición, desde `web/`: `node .design-sync/review/parity-check.mjs --base
  http://127.0.0.1:4310 [--out <dir>]`. Por omisión escribe en `.design-sync/.cache/parity/`
  (gitignored) `<Historia>-{web,mobile,diff}.png` y `report.json` (`[{ story, diffRatio }]`). Usa
  `pixelmatch@7` y `pngjs@7` de `.ds-sync` (ver "Preparar").
- Las capturas quitan el margen de la celda y el `transform` de `.ds-single`: con él, lo `fixed`
  (barra de pestañas, acciones del paso) quedaba al final del contenido en lugar de abajo del
  teléfono. Se captura con Work Sans cargada y dos cuadros ya pintados, sin espera fija (tres
  corridas seguidas dan el mismo `report.json`).
- `diffRatio` es una guía, no una prueba: el texto nunca coincide píxel a píxel, porque la web carga
  Work Sans variable de Google Fonts y la app móvil los TTF estáticos de `@expo-google-fonts` (en el
  diff se ve rojo dentro de las letras, no fuera). Revisa el `-diff.png` de cada pareja que suba.

Regla de veredicto, en este orden (cualquier otra cosa es estructural y se corrige):

1. **por diseño**: el `-diff.png` muestra una diferencia acordada: 4.ª pestaña Beneficiarios, fila
   "Filtros", cuentas propias como destinatario, select nativo de una línea, textos propios de cada
   app, "Mostrar CLABE" de la web (R29) o la ayuda del monto de cada app (R30). La nota dice cuál y
   "resto" es el `diffRatio` de la misma captura sin esa zona (alineando lo que esta empuja).
2. **idéntico**: si no, `diffRatio` < 0.002.
3. **suavizado**: si no, y al revisar el `-diff.png` solo hay píxeles en el borde de los glifos
   (rasterizado distinto de Work Sans): ningún elemento se movió, cambió de tamaño ni de color.

| Historia | diffRatio | Veredicto | Nota |
|---|---|---|---|
| `Home` | 0.0119 | por diseño | 4.ª pestaña Beneficiarios y "Mostrar CLABE" de la web (R29: mismo aspecto, funciones propias); resto 0.0041 |
| `HomeEmpty` | 0.0140 | por diseño | 4.ª pestaña; texto del vacío de cada app; resto 0.0016 |
| `HomeError` | 0.0081 | por diseño | 4.ª pestaña; resto 0.0000 |
| `HomeLoading` | 0.0081 | por diseño | 4.ª pestaña; resto 0.0000 |
| `Login` | 0.0048 | por diseño | nota de registro (la app móvil no registra); resto 0.0008 |
| `Movements` | 0.0439 | por diseño | fila "Filtros" (+56 px) y 4.ª pestaña; lista alineada 0.0053 |
| `MovementsEmpty` | 0.0270 | por diseño | "Filtros", vacío filtrado de la web ("Limpiar filtros") y 4.ª pestaña; encabezado 0.0000 |
| `TransferAmount` | 0.0218 | por diseño | select nativo de una línea con el saldo en la ayuda (móvil: dos líneas) y la ayuda del monto de cada app (R30: describe cómo lee el monto cada una; concepto y referencia ya usan la redacción móvil); arriba 0.0022, abajo (+10 px) 0.0022 |
| `TransferCompleted` | 0.0025 | suavizado | |
| `TransferFailed` | 0.0016 | idéntico | |
| `TransferOtp` | 0.0037 | por diseño | "Vence a las 12:05." (web) frente a la cuenta regresiva de móvil |
| `TransferRecipient` | 0.0111 | por diseño | la web ofrece también las cuentas propias; beneficiarios alineados 0.0044 |
| `TransferRejected` | 0.0029 | suavizado | |
| `TransferReview` | 0.0013 | idéntico | |
| `TransferUncertain` | 0.0013 | idéntico | |

Lo que se alineó para llegar ahí (en la primera medición, con el `transform`, `TransferFailed` daba
0.0671 y `TransferAmount` 0.0537):

- Kit web: AccountCard (120 px como en móvil: borde de 2 px y 4 px entre filas; toda la tarjeta
  selecciona con el `::after` del botón del nombre y el de la CLABE va encima con su área de 44 px,
  R31), MovementRow (el tipo pasa a dos líneas en lugar de cortarse), Receipt (sin
  título visible, etiqueta pequeña sobre el valor, " · " entre nombre y terminación), OtpField (a
  todo lo ancho), AmountField hero (ancho medido con un espejo, como en móvil; etiqueta y ayuda
  centradas), campos a 4 px de su etiqueta, EmptyState (ayuda en `body`), Skeleton de tarjeta
  (128 px), Wordmark completo en `h1` solo en la superficie de marca (`size="brand"`, R32; en los
  encabezados sigue en `h2`), StatusBadge de 24 px, chevron del sistema en Select,
  ErrorState con "Reintentar" fuera de la alerta y dígitos tabulares en el límite diario.
- Kit móvil: Receipt sin borde (D4) y con `fromAccountClabe` opcional para mostrar la terminación
  de origen; dígitos tabulares en el código y en la CLABE de AccountCard.
- Historias: mismos espacios en Login, el destinatario del monto y las filas de destinatario; el
  monto tecleado igual en las dos ("1250.00"); las ayudas de concepto y referencia con la
  redacción móvil (R30); los nombres de Beneficiarios ya no se cortan; el
  error de Inicio en móvil con el título de la lectura, como el ErrorState de la web.
