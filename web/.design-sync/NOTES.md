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
(cd .ds-sync && npm i esbuild ts-morph @types/react@19.3 playwright@1.61.1)
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
