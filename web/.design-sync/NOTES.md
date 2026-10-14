# design-sync — web (TreoWallet Web)

Sincroniza el sistema de diseño de la web con un proyecto de Claude Design. Todo se ejecuta desde `web/`.

## Cómo está armado

- La app no publica un paquete ni tiene Storybook. `build-ui.mjs` (el `buildCmd`) arma un paquete
  sintético `wallet-web-ui` en `.design-sync/.cache/pkg/` (gitignored): `dist/index.mjs` (esbuild
  sobre `entry.ts`, alias `@/` del tsconfig, React externo), `dist/types/**` (tsc de la app con
  `emitDeclarationOnly`; los `@/` se reescriben a rutas relativas) y `dist/styles.css`.
- `entry.ts` es la lista explícita de lo que se sincroniza: components/ui (con `StepActions`) +
  LoadingState/ErrorState, `AppShell` y `BrandShell` (las estructuras de página), StepHeading y las
  piezas de los bonus (`ScheduleField`, `StatementDownload`). También exporta, sin tarjeta, las
  funciones de montos `sumAmounts` (web) y `formatMXN`, `toCents`, `centsToDecimalString` (contrato),
  para que las historias y el agente de diseño sumen y muestren montos en centavos, nunca con
  `Number`. Agregar un componente = exportarlo ahí (y su grupo en `docs/`).
- `dist/styles.css` es `app/globals.css` compilado con `@tailwindcss/postcss` de la app
  (`tailwind.css` es la entrada). Es estático: solo existen las clases que aparecen en la app, en
  `previews/` o en los `@source inline(...)` de `tailwind.css` (el vocabulario que puede usar el
  agente de diseño). **Si una preview usa una clase nueva, vuelve a correr `buildCmd` antes de
  `package-build.mjs`**; `preview-rebuild.mjs` no recompila el CSS.
- Work Sans: un solo archivo versionado, `app/fonts/WorkSans-latin.woff2` (la variable de pesos de
  Google Fonts v24, subconjunto latino; licencia OFL en `app/fonts/OFL.txt`). La app lo sirve con
  `next/font/local` y el lienzo con `fonts.css` (`extraFonts` de `config.json`, que lo copia a
  `fonts/` del bundle), así que los dos dibujan el mismo texto; `app/fonts.test.ts` lo comprueba.
  `tailwind.css` define `--font-work-sans` en `:root`, porque `globals.css` arma `--dt-font-sans`
  con esa variable. Antes el lienzo la pedía a Google Fonts, que entrega otra compilación según el
  navegador (con otros anchos de letra que la que guardaba `next/font/google`).
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
- El viewport de captura es de 900 px: aplican los breakpoints `sm:` y la forma de app (por debajo
  de `dashboard:`, 1024 px). AccountCard, Select, LoadingState, BrandShell e Icon van en
  `cardMode: column`, igual que ScheduleField, StatementDownload y StepActions; AppShell en `single` con `Home` como historia principal (R23: la hoja fija de
  `MovementsFilters` desbordaba la grilla) y BottomSheet en `single` de 480x520.
- Las previews de componentes van en el contexto del rediseño: sobre el lienzo de la app
  (`bg-surface-canvas`, con el margen de 20 px) y, donde las pantallas reales los ponen, dentro de
  una `ListSection` (el límite diario, las filas de movimientos, los estados de carga de una lista).
- `StepHeading` se enfoca al montarse: en las previews va con `focus={false}` para no robar el foco
  ni desplazar el lienzo. Por lo mismo, no se usa `focusOnMount` de InlineAlert.
- `ErrorState` pasa `error` por `describeError`, que solo da mensajes por `code` con una instancia
  de `ProblemError` (no se exporta en `entry.ts`). Las previews usan `new TypeError('Failed to
  fetch')`, que muestra el mensaje de conexión. Para previsualizar mensajes por código habría que
  reexportar `ProblemError` desde `entry.ts` (y excluirlo de las tarjetas con `componentSrcMap`).
- `AppShell` y `BrandShell` son los de la app; las historias pasan `onLogout={noop}`. Los enlaces del
  kit (`RouterLink`) son `<a>` en el lienzo, porque solo AppFrame conecta `next/link`; el `next/link`
  que importan `ScheduleField` y `StatementDownload` se resuelve a `next-link.ts` en `build-ui.mjs`.
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

Ninguno: el último validate (tarea 8.3) terminó limpio, 36/36 previews y "bundle is complete".
`[DOCS_UNMAPPED]` de AppShell, BrandShell, ErrorState, LoadingState, ScheduleField,
StatementDownload y StepHeading es informativo: viven fuera de `components/ui` y toman el grupo de
su carpeta. Ya no aparece `[FONT_REMOTE]`: Work Sans viaja en el bundle (`fonts/`).

## Re-sync risks

- `dtsPropsFor` copia a mano los tipos del contrato (Movement, Transfer, Account, DailyLimit). Si
  `contract/openapi.yaml` cambia (nuevo estado, campos o motivos), actualízalos.
- `entry.ts` es una lista explícita: un componente nuevo en `components/ui` no se sincroniza hasta
  que se exporte ahí y tenga su stub en `docs/`.
- El CSS sale de `app/globals.css` + el safelist de `tailwind.css`: si la app cambia de tokens o de
  versión de Tailwind, revisa que el safelist siga generando las familias del header.
- Work Sans es un archivo versionado (`app/fonts/`): si se cambia, cambia en la app y en el lienzo a
  la vez, y la paridad con las historias aprobadas se vuelve a medir.
- Las historias de `AppShell` copian el JSX de las pantallas reales
  (`components/{auth,accounts,beneficiaries,transfers}`) sobre el kit real: si una pantalla cambia,
  su historia queda desfasada sin que nada falle. `parity-real.mjs` lo detecta (columna A).
- Las grades viven en `.design-sync/.cache/review/` (gitignored); la verificación entre máquinas sale
  del `_ds_sync.json` subido al proyecto.

## Mapa de pantallas (`previews/AppShell.tsx`)

Cada ruta y cada estado de página completo es una historia de `AppShell` (o de `BrandShell` para las
públicas), portada del JSX de la pantalla real sobre el kit real (las pantallas no se pueden
importar: usan Server Actions, TanStack Query y next/navigation). Los nombres son los de las
historias de `Screen` de la app móvil, para que `parity.html` y `parity-check.mjs` las emparejen:

| Ruta | Historias |
|---|---|
| `/login`, `/register`, `/verify-email` (BrandShell) | `Login`, `Register`, `VerifyEmail` |
| `/` | `Home`, `HomeEmpty`, `HomeLoading`, `HomeError` |
| `/accounts/[id]/movements` | `Movements`, `MovementsEmpty`, `MovementsFilters` |
| `/transfers/new` (`mode="flow"`) | `TransferRecipient`, `TransferAmount`, `TransferReview`, `TransferUncertain`, `TransferRejected`, `TransferOtp`, `TransferCompleted`, `TransferFailed`; programada (bonus): `TransferAmountScheduled`, `TransferReviewScheduled`, `TransferScheduled` |
| `/transfers/scheduled` (bonus) | `ScheduledTransfers`, `ScheduledTransfersEmpty`, `ScheduledTransfersCancel`, `ScheduledTransfersCancelError` |
| `/beneficiaries`, `/beneficiaries/new` | `Beneficiaries`, `BeneficiariesEmpty`, `NewBeneficiary` |
| `/transfers/[id]` | `TransferDetail` |

- Las parejas con la app móvil son `Login`, las cuatro de Inicio, `Movements`, `MovementsEmpty` y
  los pasos del flujo de `TransferRecipient` a `TransferFailed` (15). Las demás son solo de la web.
- Datos canónicos (iguales en la historia móvil): Ana, Principal (`…9719`, $25,000.00), Ahorro
  (`…1234`, $10,000.00), Luis (`…5678`) y Mamá (`…4321`), el límite con $31,500.00 disponibles y el
  reloj en el 13 de octubre de 2026 a las 12:00 de la Ciudad de México.
- Los montos calculados se restan y suman en centavos con las funciones que exporta `entry.ts`
  (`sumAmounts`, `toCents`, `centsToDecimalString`) y se muestran con `formatMXN`; las CLABE
  enmascaradas y las horas van ya formateadas (`maskClabe` y `formatTime` no se exportan).
- Las acciones de los pasos usan el `StepActions` del kit, el mismo de la app: fijas abajo en
  teléfono, con el espaciador que deja lo último del paso a 20 px del pie.
- Omitidos a propósito (variantes de una sola alerta o ya cubiertos por previews de componentes):
  `/login?reason=expired`, subestados del código (entrega fallida, reenviado, código inválido),
  `/transfers/[id]` en `PENDING_OTP` (está en `StepHeading`: `DetailPendingOtp`), errores de
  validación por campo.

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
- `diffRatio` es una guía, no una prueba: el texto nunca coincide píxel a píxel, porque la web usa
  Work Sans variable (`app/fonts/`) y la app móvil los TTF estáticos de `@expo-google-fonts` (en el
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
| `MovementsEmpty` | 0.0350 | por diseño | "Filtros", vacío filtrado de la web ("Limpiar filtros"), 4.ª pestaña y, desde P2, la tarjeta "Estado de cuenta" (R53; antes 0.0270); encabezado 0.0000 |
| `TransferAmount` | 0.0218 | por diseño | select nativo de una línea con el saldo en la ayuda (móvil: dos líneas) y la ayuda del monto de cada app (R30: describe cómo lee el monto cada una; concepto y referencia ya usan la redacción móvil); arriba 0.0022, abajo (+10 px) 0.0022 |
| `TransferCompleted` | 0.0025 | suavizado | |
| `TransferFailed` | 0.0016 | idéntico | |
| `TransferOtp` | 0.0037 | por diseño | "Vence a las 12:05." (web) frente a la cuenta regresiva de móvil |
| `TransferRecipient` | 0.0129 | por diseño | la web ofrece también las cuentas propias y, desde P2, el enlace "Transferencias programadas" de teléfono (R56; antes 0.0111); beneficiarios alineados 0.0044 |
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

## Paridad (pantallas reales)

Tareas 8.1 y 8.3 del rediseño (WEB-25, final-review M-8): cada pantalla real contra su historia aprobada y
cada pareja web↔móvil sobre código real, a 390×844 (ventana y página completa) y, la web, a 1280×800.
`review/parity-real.mjs` captura y mide; escribe en `.design-sync/.cache/parity-real/` (gitignored)
`approved/`, `real/`, `diff/` y `report.json` (`[{ story, A390, A390full, B1280, B1280full, C390,
C390full, D390, D390full }]`, cada uno `{ ratio, heights }` o `null`).

- **A** web real ↔ historia aprobada a 390; **B** lo mismo a 1280; **C** vista móvil real ↔
  historia aprobada; **D** web real ↔ móvil real (la pareja).

### Cómo se captura

- **Web — la app real, completa.** `next dev` del worktree en `127.0.0.1:3101` con `API_BASE_URL`
  apuntando a `web/e2e/fake-api.mjs` en `127.0.0.1:4999`, que sirve los datos canónicos de las
  historias con las formas del contrato y responde las llamadas de las Server Actions (crear →
  `COMPLETED` por $1,250.00, `PENDING_OTP` por $15,000.00, 422 `INSUFFICIENT_FUNDS` por $30,000.00;
  confirmar `000000` → 422 `OTP_ATTEMPTS_EXHAUSTED`). Playwright inicia sesión por el formulario
  real, fija el reloj del navegador en `2026-10-13T18:00:00Z` (para que "Hoy"/"Ayer" coincidan con
  las historias) y llega a cada estado como una persona; el estado incierto aborta en el navegador
  la petición de la Server Action. Nada toca el PostgreSQL sembrado; el 3000 (Grafana) y el 4000 (la
  API de la persona usuaria) no se usan.
- **Móvil — las vistas reales en el lienzo de react-native-web** (alternativa: aquí no corre la pila
  completa). No hay dispositivo ni simulador; la app no depende de `react-native-web`, `react-dom`
  ni `@expo/metro-runtime` (solo están en `mobile/.ds-sync/`) y en web `expo-secure-store` no tiene
  implementación, así que la app real no puede iniciar sesión en Expo web (MOB-02 prohíbe el
  respaldo en AsyncStorage). Las tareas 7.2–7.5 dejaron cada pantalla como una vista pura
  `*-view.tsx` (la guarda `src/__tests__/views-are-pure.test.ts`); las historias de `Screen`
  (`mobile/.design-sync/previews/Screen.tsx`) usan esas vistas con los datos canónicos, así que el
  lienzo renderiza el código de presentación real con el mismo tema y react-native-web que la app
  usaría en web.
- Antes de cada captura de la web real el puntero sale a (0, 0) y no hay transiciones: el último
  clic dejaba el botón de abajo en su estado hover (lima), que el lienzo nunca muestra. La hoja de
  filtros se abre con el teclado, como la ve el lienzo (anillo de `:focus-visible` en "Cerrar").
- Página completa de la pareja (D completa): las dos como un teléfono tan alto como su contenido
  (`-tall.png`: la web con la ventana del alto del documento; la móvil con el marco de 390×844
  crecido lo que le falta a su ScrollView). En la página completa de Chromium lo `fixed` (pestañas,
  pie del paso) se queda donde estaba la ventana; así baja al final, como en la app. La línea base
  móvil aprobada se capturó con el marco fijo: C completa compara esos 844 px.
- **Fuente.** La app (`next/font/local`) y el lienzo (`fonts.css`) usan el mismo archivo,
  `app/fonts/WorkSans-latin.woff2` (tarea 8.3). Antes, Google Fonts entregaba otra compilación de
  Work Sans según el agente: `next/font/google` guardaba la de su agente (Chrome 104) y el Chromium
  de captura del lienzo recibía otra, con otros anchos de letra ("Transferir" a 400: 64 px frente a
  67 px). En 8.1 la corrida normal de A/B nunca bajaba de ~0.002 por eso, y los veredictos se tomaron
  con una opción `--font canvas` que servía a la web real el archivo del lienzo. Con el archivo fijo,
  la corrida normal (lo que ve la persona usuaria) ya da 0.0000 fuera de las zonas acordadas y el
  script no usa la red.
- **Arranque de la web.** `next dev` usa Turbopack. Si se detiene con "OS file watch limit reached",
  el presupuesto de inotify del usuario está lleno (65,536 observadores; en 8.3, VS Code tenía unos
  52,700 y Expo unos 8,000): hay que liberar observadores antes de capturar. La corrida de 8.3 se hizo
  con `next dev --webpack` porque Turbopack no arrancaba; la comparación es de píxeles ya dibujados y
  el archivo de fuente servido era el mismo (mismo SHA-256 que `app/fonts/`), pero conviene repetirla
  con Turbopack. El script espera a que la página de inicio de sesión no tenga red pendiente antes de
  escribir (con un servidor lento, el formulario se enviaba antes de hidratarse).

### Comandos

```bash
# 1. Antes de reconstruir los lienzos: la línea base aprobada (el servidor de revisión sirve
#    web/ds-bundle y mobile/ds-bundle desde disco; --base si no es el de 4310).
cd web && node .design-sync/review/parity-real.mjs --phase approved [--base http://127.0.0.1:4321]
# 2–3. Cambios y reconstrucción de los lienzos (ver "Revisión local").
# 4. La web real (en segundo plano) contra la API simulada:
node e2e/fake-api.mjs --port 4999
API_BASE_URL=http://127.0.0.1:4999 SESSION_COOKIE_SECURE=false npx next dev --port 3101 --hostname 127.0.0.1
# 5. Capturar y comparar:
node .design-sync/review/parity-real.mjs --phase real [--base http://127.0.0.1:4321]
```

Regla de veredicto: la de "Paridad" (por diseño → idéntico → suavizado; lo demás es estructural y
se corrige), aplicada a cada columna. La columna "Veredicto" da el de la peor columna y la nombra
entre paréntesis; con "por diseño", la nota dice la zona acordada y el "resto" de esa columna, que
a su vez cumple la regla (idéntico si es < 0.002; si no, suavizado tras revisar el `-diff.png`).

### Resultado

Corrida de la tarea 8.3, con la fuente fija: la web real (`next dev --webpack`, ver "Arranque de la
web", contra la API simulada) contra
los lienzos de antes de reconstruirlos (los de P2, con las historias aprobadas) y contra las vistas
móviles reales. D: ventana y, entre paréntesis, página completa (`-tall`).

| Historia | A 390 (completa) | B 1280 | C móvil | D pareja | Veredicto (columna) | Nota |
|---|---|---|---|---|---|---|
| `Beneficiaries` | 0.0000 (0.0000) | 0.0000 | — | — | idéntico (A, B) | "Agregar beneficiario" en la barra superior, como la historia (R44, WEB-26) |
| `BeneficiariesEmpty` | 0.0000 (0.0000) | 0.0000 | — | — | idéntico (A, B) | |
| `Home` | 0.0000 (0.0000) | 0.0000 | 0.0000 | 0.0119 (0.0089) | por diseño (D) | 4.ª pestaña y "Mostrar CLABE" (R29); resto sin la barra: ventana 0.0041, página completa 0.0050 (suavizado) |
| `HomeEmpty` | 0.0000 (0.0000) | 0.0000 | 0.0000 | 0.0140 (0.0140) | por diseño (D) | 4.ª pestaña y el texto del vacío de cada app; resto 0.0010 (idéntico) |
| `HomeError` | 0.0000 (0.0000) | 0.0000 | 0.0000 | 0.0081 (0.0081) | por diseño (D) | 4.ª pestaña; resto 0.0000 |
| `HomeLoading` | 0.0000 (0.0000) | 0.0000 | 0.0000 | 0.0081 (0.0081) | por diseño (D) | 4.ª pestaña; resto 0.0000 (las dos saludan a Ana mientras cargan) |
| `Login` | 0.0000 (0.0000) | 0.0000 | 0.0000 | 0.0048 (0.0048) | por diseño (D) | la nota de registro de cada app (la app móvil no registra); resto 0.0005 (idéntico) |
| `Movements` | 0.0000 (0.0000) | 0.0000 | 0.0000 | 0.0439 (0.0400) | por diseño (D) | fila "Filtros" (+56 px), 4.ª pestaña, "Cargar más" de la web (WEB-14; la app muestra los últimos 20, MOB-20) y la tarjeta "Estado de cuenta" (R53); resto: encabezado y lista alineados 0.0042 en ventana y 0.0041 en página completa (suavizado) |
| `MovementsEmpty` | 0.0000 (0.0000) | 0.0000 | 0.0000 | 0.0350 (0.0342) | por diseño (D) | "Filtros", vacío filtrado de la web ("Limpiar filtros"), 4.ª pestaña y R53; resto: encabezado 0.0000 |
| `MovementsFilters` | 0.0000 (0.0000) | 0.0000 | — | — | idéntico (A, B) | en escritorio, el panel centrado de la historia (R44, WEB-29/D9) |
| `NewBeneficiary` | 0.0000 (0.0000) | 0.0000 | — | — | idéntico (A, B) | |
| `Register` | 0.0000 (0.0000) | 0.0000 | — | — | idéntico (A, B) | sin pie fijo, como la historia (R44, WEB-25) |
| `TransferAmount` | 0.0005 (0.0005) | 0.0046 | 0.0000 | 0.0222 (0.0847) | por diseño (A, B, D) | "Cuándo" (Ahora/Programar) bajo Referencia, el bonus de programar (R56), que esta historia no tiene (está en `TransferAmountScheduled`; la página real es 51 px más alta, 895/844); resto A 0.0000 y B 0.0000. D además: select nativo de una línea y ayuda del monto de cada app (R30); resto D 0.0026 (suavizado) |
| `TransferCompleted` | 0.0000 (0.0000) | 0.0000 | 0.0000 | 0.0025 (0.0025) | suavizado (D) | |
| `TransferDetail` | 0.0000 (0.0000) | 0.0000 | — | — | idéntico (A, B) | "Ver mis cuentas" en el `StepActions` en línea (pre-flight #20): sin diferencia visible |
| `TransferFailed` | 0.0000 (0.0000) | 0.0000 | 0.0000 | 0.0016 (0.0023) | suavizado (D completa) | en ventana, idéntico |
| `TransferOtp` | 0.0000 (0.0000) | 0.0000 | 0.0000 | 0.0037 (0.0037) | por diseño (D) | "Vence a las 12:05." (web) frente a la cuenta regresiva de móvil; resto 0.0026 (suavizado) |
| `TransferRecipient` | 0.0166 (0.0166) | 0.0041 | 0.0000 | 0.0144 (0.0144) | por diseño (A, B, D) | la fila "Principal" de "Tus cuentas" (R38: todas las cuentas propias), que empuja lo demás; el enlace "Transferencias programadas" de teléfono (R56) ya está en la historia. Resto A 0.0000 y B 0.0000 (columna del paso). D: las cuentas propias y el enlace de la web; resto 0.0029 (suavizado) |
| `TransferRejected` | 0.0080 (0.0080) | 0.0033 | 0.0000 | 0.0103 (0.0103) | por diseño (A, B, D) | título "Saldo insuficiente" y "Saldo disponible en Principal: $25,000.00" en la alerta (WEB-16); resto A 0.0000 y B 0.0000 (todo lo de arriba de la alerta); resto D sin la alerta 0.0037 (suavizado) |
| `TransferReview` | 0.0000 (0.0000) | 0.0000 | 0.0000 | 0.0013 (0.0013) | idéntico (D) | |
| `TransferUncertain` | 0.0000 (0.0000) | 0.0000 | 0.0000 | 0.0013 (0.0013) | idéntico (D) | |
| `VerifyEmail` | 0.0000 (0.0000) | 0.0000 | — | — | idéntico (A, B) | |
| `LoginRateLimited`, `StartupLoading`, `StartupOffline`, `TransferRecipientEmpty`, `TransferRetrying` | — | — | 0.0000 | — | idéntico (C) | solo móvil |
| `HomeUnlockOffer`, `LockScreen`, `LockScreenLockout`, `TransferOutcomeScheduled`, `TransferOutcomeCancelled` | — | — | 0.0000 | — | idéntico (C) | solo móvil (bonus, P2) |

- **Sin receta en `parity-real.mjs`:** las historias de los bonus de la web (`ScheduledTransfers*`,
  `TransferAmountScheduled`, `TransferReviewScheduled`, `TransferScheduled`). No tienen pareja; las
  cubren las pruebas en navegador (`e2e/scheduled.spec.ts`, axe) y su revisión en P2.
- **Alturas.** La página real de `TransferCompleted` y `TransferFailed` a 390 mide 853 y 945 px; las
  historias de antes de 8.3 medían 880 y 972 (27 px de más al final). Desde 8.3 las historias usan
  el `StepActions` del kit y miden lo mismo que la pantalla real; la ventana no cambia.
- **8.1 frente a 8.3.** Con `--font canvas`, 8.1 midió lo mismo que esta corrida normal en todas las
  historias que no cambiaron. Lo que sí cambió viene de los bonus integrados después (P1 y P2):
  `TransferAmount` ("Cuándo"), `TransferRecipient` (el enlace de teléfono, ahora también en la
  historia) y `Movements`/`MovementsEmpty`/`MovementsFilters` (la tarjeta R53, ahora también en la
  historia: la A de `MovementsEmpty` pasa de 0.0080 a 0.0000).

"Resto" es el ratio de la misma captura sin la zona acordada, juntando lo que la zona empujaba (se
quitan sus filas de cada imagen; en el dashboard se compara solo la columna del paso). Sin diferencia
visible en los casos que la lista de 8.1 preveía: el contenido a 1200 px en escritorio, la línea de
la persona en la navegación lateral, el segundo de la cuenta regresiva del código y el nivel de los
encabezados por día de Movimientos.

**Estructural, corregido en el código real** (cada uno con su prueba):

- Móvil, paso del monto (C 0.0294): `FormView` apilaba sus campos con 16 px dentro de la pantalla,
  que separa sus secciones con 20 px; ahora son secciones de la pantalla, como la historia.
- Web, detalle de una transferencia (A 0.0330, B 0.0107): al abrirla ya resuelta mostraba el título
  de paso "Transferencia enviada" sobre el comprobante; ahora solo aparece (y toma el foco, WEB-23)
  cuando el código se confirma en la página.
- Web, paso del código en escritorio (B 0.0017): las acciones iban a 16 px del campo; ahora el paso
  separa sus bloques con 20 px y el aviso, los datos y el campo van en su propia pila, como la
  historia.
- Web, final de la página a 390 (D completa): lo último quedaba a 23 px de la barra de pestañas y a
  47 px del pie fijo de un paso (`TransferFailed` 0.0530, alturas 972/945); en la app son 20 px.
  `main` reserva la barra, su borde y 20 px; el espaciador de `StepActions` mide lo que el pie (borde,
  márgenes con el área segura y uno o dos botones) y descuenta el margen inferior de `main`. Las
  historias aprobadas de la web tenían esos 27 px de más al final de los pasos largos (A completa de
  `TransferCompleted` y `TransferFailed`: la página real es 27 px más corta).

**Por diseño por R44** (el texto de la especificación y las historias aprobadas difieren; mandan las
historias): "Agregar beneficiario" como acción de la barra superior de Beneficiarios (WEB-26), el
registro sin pie fijo (WEB-25) y los filtros de escritorio en el panel centrado de la hoja, no en un
panel lateral (WEB-29/D9). Las tres pantallas dan A/B 0.0000 contra sus historias.

**Verificado:** las páginas web reales (rutas, layouts, lecturas del BFF, Server Actions, el CSS de
Tailwind y Work Sans por `next/font`) a 390 y 1280 contra las historias aprobadas; el código real
de las vistas móviles a 390×844 contra las historias aprobadas; cada pareja web↔móvil sobre código
real, en ventana y en página completa.

**No verificado aquí** (va a la lista de Expo Go del cierre): el render nativo (métricas de texto de
Hermes, rasterizado de fuentes en iOS/Android, áreas seguras en dispositivos, atrás de Android,
`adjustsFontSizeToFit`), el cableado de los contenedores móviles en píxeles (lo cubren las pruebas
RNTL de 7.1–7.5), el layout de pestañas de expo-router (el lienzo usa el `TabBar` del kit que ese
layout renderiza) y la API real (sin cambios en este cambio; se probó de punta a punta en `web-app`
9.2).

## Funciones propias de cada plataforma (bonus, P2)

Las funciones que llegaron de `release` después de aprobar las historias son **función propia de
cada plataforma**: no tienen pareja y quedan "por diseño" en la paridad. Llevan el lenguaje del
rediseño (kit, tokens, ritmo de 20 px, tarjetas sobre el lienzo, lima solo sobre oscuro, áreas de
44 px) y se revisan solas: a 390 y 1280 en la web, a 390×844 en móvil.

| Función | Plataforma | Historias | Regla |
|---|---|---|---|
| Estado de cuenta (WEB-32) | web | `AppShell`: `Movements`, `MovementsEmpty` y `MovementsFilters` (tarjeta después del historial); `StatementDownload` | R53 |
| Programar (WEB-33): "Cuándo" del paso de monto, fila "Cuándo" de la revisión y del resumen, resultado "Transferencia programada" con el aviso informativo, "Programada para" | web | `AppShell`: `TransferAmountScheduled`, `TransferReviewScheduled`, `TransferScheduled`; `ScheduleField`; `Receipt`: `Scheduled` | R56 |
| Programadas (WEB-34): lista, vacío, diálogo de cancelar, `TRANSFER_NOT_CANCELLABLE`; "Programadas" con su icono (CalendarClock) en la navegación lateral y el enlace del paso de destinatario en teléfono | web | `AppShell`: `ScheduledTransfers`, `ScheduledTransfersEmpty`, `ScheduledTransfersCancel`, `ScheduledTransfersCancelError`, `TransferRecipient`; `SideNav`: `Scheduled`; `Receipt`: `Cancelled`; `StatusBadge`: `AllStatuses` | R56, R58 |
| Desbloqueo biométrico (MOB-24 a MOB-27) | móvil | ver `mobile/.design-sync/NOTES.md` | R46 |
| Etiquetas `SCHEDULED` y `CANCELLED` del comprobante (MOB-23) | móvil | ver `mobile/.design-sync/NOTES.md` | MOB-23 |

- **Sin pareja a propósito.** Los nombres de las historias propias no coinciden entre `AppShell` y
  `Screen`, así que `parity-check.mjs` no las compara (las de móvil se llaman `TransferOutcome*`, no
  `TransferScheduled`).
- **Medición de P2** (`parity-check.mjs` contra un servidor de revisión temporal en 4321 con los
  bundles de P2): las 15 parejas dan lo mismo que en 8.1 salvo `TransferRecipient`, 0.0129 (0.0125
  en 8.1), por el enlace de teléfono de R56. `MovementsEmpty` da 0.0350, lo mismo que la pantalla
  real en 8.1: la historia ahora tiene la tarjeta de R53.
- **Lo que comparten las dos plataformas.** La insignia "Programada" usa el tono informativo y
  "Cancelada" el neutro (DSG-18), y el título del comprobante es el mismo en las dos:
  "Transferencia programada" para `SCHEDULED` y "Estado de la transferencia" para `CANCELLED`. El
  comprobante web agrega "Programada para" (WEB-34); el de móvil no, porque MOB-23 solo pide etiqueta
  y tono y la app no programa.
- **Correcciones de estilo de P2** (cada una con su prueba): la nota del resultado programado es el
  aviso informativo del kit (`InlineAlert`), como el aviso de la fallida sobre su comprobante;
  "Transferencia cancelada" es el aviso de éxito del kit dentro de la región `polite` que siempre
  existe (`InlineAlert` con `announce={false}`, sin un segundo rol); el diálogo de cancelar tiene la
  anatomía de `BottomSheet` (asa en teléfono, 12 px arriba, título en una fila de 44 px y 16 px
  entre filas), así que su título queda a la misma altura que el de "Filtrar movimientos"; y los
  valores largos del resumen se reparten parejo (`text-balance`), sin "2026" suelto.
- **Fechas fijas.** La captura de design-sync fija el reloj en 2024-05-15. `StatementDownload` y
  `ScheduleField` reciben `now` (opcional, como `MovementList`) y sus historias pasan NOW; las
  historias de `AppShell` componen la tarjeta y "Cuándo" con el kit y fechas de NOW.
- **`next/link` en el lienzo.** `ScheduleField.tsx` exporta también la nota del resultado, que usa
  `next/link` (CommonJS, necesita el router de Next). `build-ui.mjs` lo resuelve a `next-link.ts`,
  el `RouterLink` del kit sin proveedor (un `<a>`); sin ese alias el bundle no cargaba ("Dynamic
  require of react/jsx-runtime").

## Subida a Claude Design

Pendiente: subir a Claude Design. Requiere autenticarse con `/design-login` (no se ha hecho en este entorno); después, `resync` desde cada app según 'Preparar'.
