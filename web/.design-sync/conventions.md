# TreoWallet Web — convenciones para diseñar con este sistema

Billetera digital en pesos mexicanos (panel web en Next.js). Todo el texto de la interfaz va en
español de México. Los componentes son React DOM y se estilizan con **utilidades de Tailwind v4
sobre tokens semánticos**.

## Montaje

- Todo está en `window.TreoWalletWeb`. No hace falta proveedor: `styles.css` ya carga los tokens, el
  CSS compilado y Work Sans, y la capa base pone `bg-surface text-fg font-sans text-body` en `body`.
- `PageShell` es la raíz de cada página: encabezado con el Wordmark (la navegación y "Cerrar sesión"
  van en `actions`) y `main` centrado en `max-w-5xl`. En páginas públicas (login, registro) el
  contenido va en `mx-auto grid w-full max-w-md gap-6`.
- Los controles pasan todas las props nativas al elemento aunque su `.d.ts` no las liste:
  `onClick`, `type`, `disabled`, `value`, `defaultValue`, `onChange`, `name`, `placeholder`,
  `inputMode`, `autoComplete`, `maxLength`. Para un enlace con aspecto de botón usa
  `buttonClasses('primary' | 'secondary' | 'ghost' | 'destructive')` en el `className` del `<a>`.

## Las pantallas de la app

Cada pantalla real está como historia de `PageShell` (en `components/layout/PageShell/`):
`LoginPage`, `RegisterPage`, `VerifyEmailPage`, `AccountsPage`, `AccountsEmpty`, `MovementsPage`,
`MovementsEmpty`, `BeneficiariesPage`, `BeneficiariesEmpty`, `NewBeneficiaryPage`, el flujo
`TransferFormPage` → `TransferConfirmPage` (o `TransferInsufficientFundsPage` /
`TransferUncertainPage`) → `TransferOtpPage` → `TransferReceiptPage` (o `TransferRejectedPage`), y
`TransferDetailPage`. Para rediseñar o crear una pantalla, parte de la historia más cercana: trae
el encabezado, la navegación y el layout de la app.

## Estilo: solo las clases que existen

El CSS es estático: **solo funcionan las clases compiladas en `_ds_bundle.css`**. No hay paleta por
defecto de Tailwind (`bg-green-500`, `text-gray-600` no existen), ni `shadow-sm/md`, ni
`rounded-full` como radio del sistema.

| Familia | Clases |
|---|---|
| Superficies | `bg-surface`, `bg-surface-subtle`, `bg-surface-brand`, `bg-surface-inverse` |
| Texto | `text-fg`, `text-fg-secondary`, `text-fg-muted`, `text-fg-on-action`, `text-fg-on-inverse`, `text-action` |
| Acción y bordes | `bg-action`, `bg-action-active`, `border-border`, `border-border-input`, `border-action`, `ring-2 ring-action` |
| Estados | `text-{success,warning,danger,info,neutral}` con `bg-{…}-soft` |
| Dinero | `text-money-in` (entradas, verde), `text-money-out` (salidas, tinta; nunca rojo), `tabular-nums` |
| Tipografía | `text-display`, `text-h1`, `text-h2`, `text-h3`, `text-body`, `text-body-sm`, `text-label`, `text-caption` (traen tamaño, interlineado y peso) |
| Forma | `rounded-sm` (controles), `rounded-md` (tarjetas), `rounded-lg` (paneles), `rounded-pill` (botones, insignias), `shadow-card` |
| Espaciado | `p/px/py/pt/pb/m/mx/my/mt/mb/gap/space-y-{0,0.5,1,1.5,2,3,4,5,6,8,10,12,16}` (4 px por paso) |
| Layout | `flex`, `grid`, `grid-cols-{1..6,12}`, `col-span-*`, `items-*`, `justify-*`, `w-full`, `w-1/2`, `max-w-{sm…5xl}`, prefijos `sm:`/`md:`/`lg:` |

Patrones de la app: tarjeta `rounded-md bg-surface-brand p-5 shadow-card`; panel
`rounded-lg bg-surface p-6 shadow-card`; fila de lista `border-b border-border py-3`; encabezado de
página `flex flex-wrap items-end justify-between gap-4` con `h1.text-h1` y la acción primaria.

## Dónde está la verdad

- `_ds_bundle.css`: todas las clases disponibles. Búscala ahí antes de usar una poco común.
- `tokens/tokens.css`: las variables `--dt-*` (colores, tipografía, radios, movimiento).
- `components/<grupo>/<Name>/<Name>.prompt.md` (ejemplos que renderizan) y `<Name>.d.ts` (props;
  `Movement`, `Transfer`, `Account` y `DailyLimit` vienen escritos completos).

## Datos y textos

Los montos van como string decimal con 2 decimales (`"25000.00"`, con signo en los movimientos:
`"-1500.00"`) y los componentes los formatean (`$25,000.00`). Las CLABE son de 18 dígitos y se
enmascaran (`CLABE •••• 9719`). Fechas ISO 8601, mostradas en hora de Ciudad de México.

## Ejemplo: inicio con sesión

```jsx
const { PageShell, Button, DailyLimitMeter, AccountCard, buttonClasses } = window.TreoWalletWeb;

<PageShell actions={<Button variant="secondary">Cerrar sesión</Button>}>
  <div className="grid gap-8">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <h1 className="text-h1">Tus cuentas</h1>
      <a href="#" className={buttonClasses('primary')}>Nueva transferencia</a>
    </div>
    <section className="grid gap-3">
      <h2 className="text-h3">Límite diario de transferencias</h2>
      <DailyLimitMeter dailyLimit={{ limit: '50000.00', used: '12000.00', remaining: '38000.00',
        resetsAt: '2026-10-14T06:00:00.000Z', timeZone: 'America/Mexico_City' }} />
    </section>
    <section className="grid gap-4 sm:grid-cols-2">
      <AccountCard account={{ name: 'Principal', clabe: '032180000118359719', balance: '25000.00' }}>
        <a href="#" className={buttonClasses('secondary')}>Ver movimientos</a>
      </AccountCard>
    </section>
  </div>
</PageShell>
```
