# TreoWallet Web — convenciones para diseñar con este sistema

Billetera digital en pesos mexicanos (panel web en Next.js). Todo el texto de la interfaz va en
español de México. Los componentes son React DOM y se estilizan con **utilidades de Tailwind v4
sobre tokens semánticos**.

## Montaje

- Todo está en `window.TreoWalletWeb`. No hace falta proveedor: `styles.css` ya carga los tokens, el
  CSS compilado y Work Sans (el mismo archivo que sirve la app), y la capa base pone
  `bg-surface text-fg font-sans text-body` en `body`.
- Los controles pasan todas las props nativas al elemento aunque su `.d.ts` no las liste:
  `onClick`, `type`, `disabled`, `value`, `defaultValue`, `onChange`, `name`, `placeholder`,
  `inputMode`, `autoComplete`, `maxLength`. Para un enlace con aspecto de botón usa
  `buttonClasses('primary' | 'secondary' | 'ghost' | 'destructive')` en el `className` del `<a>`.
- Los enlaces internos del kit (pestañas, navegación lateral, acciones rápidas, cerrar el flujo) son
  `<a href>` normales en el lienzo; en la app pasan por `next/link` (`RouterLink`). Usa `href="#"`.

## Estructura de una página

- **`AppShell`** es la raíz de cada pantalla con sesión. Props: `current` (`'home'`,
  `'movements'`, `'transfer'`, `'scheduled'`, `'beneficiaries'` o `null`), `title` (el `h1` de la
  página), `user` (`{ name, email }`), `primaryAction` (la acción de la barra superior, por ejemplo
  `<a className={buttonClasses('primary')}>Nueva transferencia</a>`), `onLogout` y `mode`.
  - **Debajo de 1024 px, forma de app:** barra de pestañas fija abajo (Inicio, Movimientos,
    Transferir, Beneficiarios) y encabezado con el saludo y el avatar del menú de la cuenta; entre
    480 y 1023 px, columna centrada de 480 px.
  - **Desde 1024 px, dashboard:** navegación lateral de 248 px (con "Programadas") y barra superior
    con el título y `primaryAction`; contenido de hasta 1200 px.
  - **`mode="flow"`:** el flujo de transferencia. Sin pestañas ni encabezado de la app en teléfono;
    empieza con `FlowHeader` (cerrar, título del paso y `Stepper`), que es el `h1`.
  - Un solo `h1` por página: lo pone AppShell (o `FlowHeader` en el flujo). Las secciones usan `h2`
    (`ListSection` con `title`).
- **`BrandShell`** (`title`, `children`) es la raíz de las pantallas públicas (inicio de sesión,
  registro, verificación): superficie de marca verde arriba y hoja blanca con el formulario; en el
  dashboard, panel dividido.
- **`StepActions`** lleva las acciones de un paso del flujo: en teléfono quedan fijas abajo, con
  borde superior y un espaciador que reserva su alto (`stacked` para dos botones apilados); desde
  1024 px van en línea. Con `fixed={false}` van en línea siempre (páginas con pestañas).

## Las pantallas de la app

Cada pantalla real es una historia de `AppShell` (en `components/layout/AppShell/`). Los nombres son
los mismos que las historias de `Screen` de la app móvil, para compararlas en pareja:

| Pantalla | Historias |
|---|---|
| Inicio de sesión, registro y verificación (`BrandShell`) | `Login`, `Register`, `VerifyEmail` |
| Inicio | `Home`, `HomeEmpty`, `HomeLoading`, `HomeError` |
| Movimientos | `Movements`, `MovementsEmpty`, `MovementsFilters` (hoja de filtros abierta) |
| Transferir, paso a paso | `TransferRecipient` → `TransferAmount` → `TransferReview` (o `TransferUncertain` / `TransferRejected`) → `TransferOtp` → `TransferCompleted` (o `TransferFailed`) |
| Transferir programada (solo web) | `TransferAmountScheduled`, `TransferReviewScheduled`, `TransferScheduled` |
| Programadas (solo web) | `ScheduledTransfers`, `ScheduledTransfersEmpty`, `ScheduledTransfersCancel`, `ScheduledTransfersCancelError` |
| Beneficiarios (solo web) | `Beneficiaries`, `BeneficiariesEmpty`, `NewBeneficiary` |
| Detalle de una transferencia | `TransferDetail` |

Para rediseñar o crear una pantalla, parte de la historia más cercana: trae la estructura, la
navegación, los textos y el ritmo de 20 px de la app.

## Estilo: solo las clases que existen

El CSS es estático: **solo funcionan las clases compiladas en `_ds_bundle.css`**. No hay paleta por
defecto de Tailwind (`bg-green-500`, `text-gray-600` no existen), ni `shadow-sm/md`, ni
`rounded-full` como radio del sistema.

| Familia | Clases |
|---|---|
| Superficies | `bg-surface-canvas` (fondo de la app), `bg-surface` (tarjetas), `bg-surface-subtle`, `bg-surface-brand`, `bg-surface-inverse`, `bg-surface-hero` (hero del saldo y pantallas de marca) |
| Texto | `text-fg`, `text-fg-secondary`, `text-fg-muted`, `text-fg-on-action`, `text-fg-on-inverse`, `text-fg-on-hero-muted` (sobre `surface-hero`), `text-action` |
| Lima sobre oscuro | `bg-accent-on-dark`, `text-accent-on-dark`, `focus-visible:outline-accent-on-dark`: solo sobre `bg-surface-hero`, nunca sobre superficies claras |
| Acción y bordes | `bg-action`, `bg-action-active`, `border-border`, `border-border-input`, `border-action` |
| Estados | `text-{success,warning,danger,info,neutral}` con `bg-{…}-soft` |
| Dinero | `text-money-in` (entradas, verde), `text-money-out` (salidas, tinta; nunca rojo), `tabular-nums` |
| Tipografía | `text-display-xl` (saldo del hero), `text-display`, `text-h1`, `text-h2`, `text-h3`, `text-body`, `text-body-sm`, `text-label`, `text-caption` (traen tamaño, interlineado y peso) |
| Forma | `rounded-sm` (controles), `rounded-md` (tarjetas de cuenta), `rounded-lg` (hero, secciones, hojas), `rounded-pill` (botones, insignias), `shadow-card`, `shadow-raised`, `shadow-sheet` |
| Espaciado | `p/px/py/pt/pb/m/mx/my/mt/mb/gap/space-y-{0,0.5,1,1.5,2,3,4,5,6,8,10,12,16}` (4 px por paso; 20 px, `gap-5`, entre bloques de una pantalla) |
| Layout | `flex`, `grid`, `grid-cols-*`, `items-*`, `justify-*`, `w-full`, `max-w-app` (480 px), `max-w-content` (1200 px), `w-sidebar` (248 px), `max-w-{sm…5xl}` y los prefijos de forma `app:` (≥ 480 px) y `dashboard:` (≥ 1024 px) |

Patrones de la app: el contenido va sobre `bg-surface-canvas` en una pila `grid gap-5`; una lista o
un bloque de datos va en `ListSection` (`rounded-lg bg-surface px-5 py-4 shadow-card`, con `title`
y `action` opcionales); las filas de una lista se separan con `divide-y divide-border`; en el
dashboard, dos columnas con `dashboard:grid-cols-2`.

## Dónde está la verdad

- `_ds_bundle.css`: todas las clases disponibles. Búscala ahí antes de usar una poco común.
- `tokens/tokens.css`: las variables `--dt-*` (colores, tipografía, radios, elevaciones, layout).
- `components/<grupo>/<Name>/<Name>.prompt.md` (ejemplos que renderizan) y `<Name>.d.ts` (props;
  `Movement`, `Transfer`, `Account` y `DailyLimit` vienen escritos completos).

## Datos y textos

Los montos van como string decimal con 2 decimales (`"25000.00"`, con signo en los movimientos:
`"-1500.00"`) y los componentes los formatean (`$25,000.00`). Para sumar o restar montos usa
`sumAmounts`, `toCents` y `centsToDecimalString` (aritmética en centavos, nunca `Number`), y
`formatMXN` para mostrarlos. Las CLABE son de 18 dígitos y se enmascaran (`CLABE •••• 9719`). Fechas
ISO 8601, mostradas en hora de Ciudad de México; las listas de movimientos se agrupan por día
("Hoy", "Ayer", "9 oct") con `MovementList`.

## Ejemplo: inicio con sesión

```jsx
const {
  AppShell, BalanceHero, QuickActions, AccountCard, ListSection, DailyLimitMeter, MovementList,
  buttonClasses, sumAmounts,
} = window.TreoWalletWeb;

const principal = { name: 'Principal', clabe: '646180157000009719', balance: '25000.00' };
const ahorro = { name: 'Ahorro', clabe: '646180157000001234', balance: '10000.00' };
const dailyLimit = { limit: '50000.00', used: '18500.00', remaining: '31500.00',
  resetsAt: '2026-10-14T06:00:00Z', timeZone: 'America/Mexico_City' };

<AppShell
  current="home"
  title="Inicio"
  user={{ name: 'Ana Gómez Castillo', email: 'ana@example.com' }}
  primaryAction={<a href="#" className={buttonClasses('primary')}>Nueva transferencia</a>}
  onLogout={() => {}}
>
  <BalanceHero
    total={sumAmounts([principal.balance, ahorro.balance])}
    available={dailyLimit.remaining}
    actions={<QuickActions actions={[
      { key: 't', label: 'Transferir', icon: 'transfer', href: '#' },
      { key: 'm', label: 'Movimientos', icon: 'movements', href: '#' },
    ]} />}
  />
  <div className="grid gap-5 dashboard:grid-cols-2">
    <div className="grid content-start gap-5">
      <section aria-label="Cuentas" className="grid gap-3">
        <AccountCard account={principal} selected onSelect={() => {}} />
        <AccountCard account={ahorro} onSelect={() => {}} />
      </section>
      <ListSection>
        <DailyLimitMeter dailyLimit={dailyLimit} showHeader />
      </ListSection>
    </div>
    <ListSection title="Últimos movimientos" action={<a href="#" className="text-label text-action">Ver todos</a>}>
      <MovementList movements={[]} />
    </ListSection>
  </div>
</AppShell>
```
