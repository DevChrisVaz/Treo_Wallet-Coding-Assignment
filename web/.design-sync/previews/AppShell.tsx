import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import {
  AccountCard,
  AmountField,
  AppShell,
  Avatar,
  BalanceHero,
  BottomSheet,
  BrandShell,
  Button,
  DailyLimitMeter,
  EmptyState,
  ErrorState,
  FlowHeader,
  Icon,
  InlineAlert,
  ListSection,
  LoadingState,
  MovementList,
  OtpField,
  QuickActions,
  Receipt,
  Select,
  Skeleton,
  TextField,
  buttonClasses,
  centsToDecimalString,
  formatMXN,
  initials,
  sumAmounts,
  toCents,
} from 'wallet-web-ui';

/*
 * Pantallas rediseñadas de la web (WEB-24…WEB-31): cada historia es una página completa sobre
 * AppShell (con sesión: forma de app bajo 1024 px y de dashboard desde 1024 px) o BrandShell
 * (públicas). Los textos salen de las pantallas reales (components/{auth,accounts,beneficiaries,
 * transfers}) y del flujo móvil; los nombres de las historias son los mismos que en `Screen` de la
 * app móvil, para compararlas en pareja (WEB-25).
 *
 * CLABE enmascaradas, horas y montos fijos que no pasan por un componente van ya formateados como
 * los dejan maskClabe, formatTime (hora de Ciudad de México) y formatMXN. Los montos calculados se
 * restan en centavos con toCents/centsToDecimalString (BigInt) y se muestran con formatMXN.
 */

/* ------------------------------------------------- datos canónicos (iguales en web y móvil) */

const NOW = new Date('2026-10-13T18:00:00Z'); // 12:00 en Ciudad de México
const user = { name: 'Ana Gómez Castillo', email: 'ana@example.com' };
const principal = { id: '0b9a4f8e-1c2d-4e5f-8a9b-0c1d2e3f4a51', name: 'Principal', clabe: '646180157000009719', balance: '25000.00', currency: 'MXN' as const, createdAt: '2026-09-30T15:00:00Z' };
const ahorro = { id: '0b9a4f8e-1c2d-4e5f-8a9b-0c1d2e3f4a52', name: 'Ahorro', clabe: '646180157000001234', balance: '10000.00', currency: 'MXN' as const, createdAt: '2026-09-30T15:00:00Z' };
const dailyLimit = { limit: '50000.00', used: '18500.00', remaining: '31500.00', resetsAt: '2026-10-14T06:00:00Z', timeZone: 'America/Mexico_City' as const };
const luis = { id: '5d1e7c3a-9b2f-4a6e-8c0d-1e2f3a4b5c61', name: 'Luis Pérez Ramírez', alias: 'Luis', clabe: '646180157000005678', createdAt: '2026-10-01T15:00:00Z' };
const mama = { id: '5d1e7c3a-9b2f-4a6e-8c0d-1e2f3a4b5c62', name: 'María Gómez', alias: 'Mamá', clabe: '646180157000004321', createdAt: '2026-10-01T15:00:00Z' };
// Últimos movimientos de Principal (más reciente primero). Hoy: 1, ayer: 2, 9 oct: 1, 30 sept: 1.
const movements = [
  { id: 'mv-1', type: 'TRANSFER_OUT' as const, amount: '-1250.00', balanceAfter: '25000.00', concept: 'Renta', reference: '1', counterparty: { name: 'Luis', clabeLast4: '5678' }, transferId: '7f1c2a8e-5a0b-4c4e-9a59-8f0e1c2d3b4a', occurredAt: '2026-10-13T16:42:00Z' },
  { id: 'mv-2', type: 'TRANSFER_IN' as const, amount: '450.00', balanceAfter: '26250.00', concept: 'Pago de la comida', reference: '9', counterparty: { name: 'Andrea Ruiz', clabeLast4: '8842' }, transferId: '3b5d7f9a-1c2e-4b4d-8f6a-0c2e4a6b8d91', occurredAt: '2026-10-12T23:10:00Z' },
  { id: 'mv-3', type: 'TRANSFER_OUT' as const, amount: '-150.00', balanceAfter: '25800.00', concept: 'Despensa', reference: '1', counterparty: { name: 'Mamá', clabeLast4: '4321' }, transferId: '9b3e4c0a-7c2d-4e6a-8c7b-0a2f3e4d5c6b', occurredAt: '2026-10-12T15:05:00Z' },
  { id: 'mv-4', type: 'OWN_TRANSFER_OUT' as const, amount: '-3000.00', balanceAfter: '25950.00', concept: 'Ahorro quincenal', reference: '15', counterparty: { name: 'Ahorro', clabeLast4: '1234' }, transferId: '8a2d3b9f-6b1c-4d5f-9b6a-9f1e2d3c4b5a', occurredAt: '2026-10-09T18:20:00Z' },
  { id: 'mv-5', type: 'DEPOSIT' as const, amount: '28950.00', balanceAfter: '28950.00', concept: 'Depósito inicial', reference: '1', counterparty: null, transferId: '1e2f3a4b-5c6d-4e7f-8a9b-0c1d2e3f4a5b', occurredAt: '2026-09-30T15:05:00Z' },
];
// Transferencia del flujo sin código: Principal → Luis, $1,250.00, "Renta", ref. 1.
// Transferencia del flujo con código: Principal → Luis, $15,000.00, "Renta", ref. 1 (mayor a $10,000.00).

/* ------------------------------------------------------------- transferencias derivadas */

/** La transferencia sin código ya enviada: es el movimiento mv-1 del historial. */
const sentTransfer = {
  id: movements[0]!.transferId,
  status: 'COMPLETED' as const,
  kind: 'THIRD_PARTY' as const,
  fromAccountId: principal.id,
  destination: {
    type: 'BENEFICIARY' as const,
    accountId: null,
    beneficiaryId: luis.id,
    displayName: luis.alias,
    clabeLast4: luis.clabe.slice(-4),
  },
  amount: '1250.00',
  concept: 'Renta',
  reference: '1',
  requiresOtp: false,
  otp: null,
  rejectionReason: null,
  failureReason: null,
  createdAt: '2026-10-13T16:41:00Z',
  completedAt: '2026-10-13T16:42:00Z' as string | null,
};

/** La transferencia con código cancelada al agotar los intentos (OTP_ATTEMPTS_EXHAUSTED). */
const failedTransfer = {
  ...sentTransfer,
  id: '4c8e2f6a-1b3d-4e5f-9a7b-6c8d0e2f4a6b',
  status: 'FAILED' as const,
  amount: '15000.00',
  requiresOtp: true,
  otp: {
    channel: 'EMAIL' as const,
    deliveryStatus: 'SENT' as const,
    maskedDestination: 'an***@example.com',
    expiresAt: '2026-10-13T17:46:00Z',
    attemptsRemaining: 0,
    resendsRemaining: 3,
  },
  failureReason: 'OTP_ATTEMPTS_EXHAUSTED' as const,
  createdAt: '2026-10-13T17:41:00Z',
  completedAt: null,
};

/* ------------------------------------------------------------------ presentación */

const noop = () => undefined;

/** maskClabe de lib/money.ts. */
const mask = (clabe: string) => `•••• ${clabe.slice(-4)}`;

/** Acción principal de la barra superior del dashboard. */
const newTransfer = (
  <a className={buttonClasses('primary')} href="#">
    Nueva transferencia
  </a>
);

const addBeneficiary = (
  <a className={buttonClasses('primary')} href="#">
    Agregar beneficiario
  </a>
);

const MOVEMENT_TYPES = [
  'Depósito',
  'Transferencia recibida',
  'Transferencia enviada',
  'Traspaso recibido',
  'Traspaso enviado',
] as const;

/**
 * BottomSheet enfoca su primer control al abrirse y el navegador desplaza la página hasta él. En un
 * lienzo con varias historias eso movería el scroll: el efecto del padre corre después del de la
 * hoja y devuelve la página a donde estaba.
 */
function KeepScroll({ children }: { children: ReactNode }) {
  const saved = useRef<[number, number]>([0, 0]);
  useLayoutEffect(() => {
    saved.current = [window.scrollX, window.scrollY];
  }, []);
  useEffect(() => {
    window.scrollTo(saved.current[0], saved.current[1]);
  }, []);
  return <>{children}</>;
}

/* ------------------------------------------------------------------ públicas (BrandShell) */

/**
 * /login — LoginForm. Campos a 16 px y la nota de registro fuera del formulario, a 24 px, como en
 * login-screen.tsx de la app móvil (WEB-25).
 */
export const Login = () => (
  <BrandShell title="Inicia sesión">
    <form noValidate className="grid gap-4">
      <TextField label="Correo" type="email" autoComplete="email" />
      <TextField label="Contraseña" type="password" autoComplete="current-password" />
      <Button type="submit" className="w-full">
        Iniciar sesión
      </Button>
    </form>
    <p className="text-center text-body-sm text-fg-secondary">
      ¿No tienes cuenta?{' '}
      <a href="#" className="inline-flex min-h-11 items-center font-medium text-action underline underline-offset-2">
        Regístrate
      </a>
    </p>
  </BrandShell>
);

/** /register — RegisterForm, con el mismo ritmo que Login. */
export const Register = () => (
  <BrandShell title="Crea tu cuenta">
    <form noValidate className="grid gap-4">
      <TextField label="Correo" type="email" autoComplete="email" />
      <TextField
        label="Contraseña"
        type="password"
        autoComplete="new-password"
        hint="Usa al menos 12 caracteres."
      />
      <TextField label="Nombre completo" autoComplete="name" />
      <TextField
        label="CURP"
        autoCapitalize="characters"
        spellCheck={false}
        hint="18 caracteres, como aparece en tu identificación."
      />
      <TextField
        label="RFC"
        autoCapitalize="characters"
        spellCheck={false}
        hint="13 caracteres, con homoclave."
      />
      <TextField
        label="Teléfono"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        hint="10 dígitos, sin lada ni espacios."
      />
      <Button type="submit" className="w-full">
        Crear cuenta
      </Button>
    </form>
    <p className="text-center text-body-sm text-fg-secondary">
      ¿Ya tienes cuenta?{' '}
      <a href="#" className="inline-flex min-h-11 items-center font-medium text-action underline underline-offset-2">
        Inicia sesión
      </a>
    </p>
  </BrandShell>
);

/** /verify-email?email=…&registered=1 — VerifyEmailForm al llegar del registro. */
export const VerifyEmail = () => (
  <BrandShell title="Verifica tu correo">
    <form noValidate className="grid gap-4">
      <InlineAlert tone="success">
        Si los datos son correctos, recibirás un correo con las instrucciones.
      </InlineAlert>
      <TextField label="Correo" type="email" autoComplete="email" defaultValue={user.email} />
      <OtpField label="Código de 6 dígitos" hint="Lo enviamos a tu correo. Vence en 15 minutos." />
      <div className="grid gap-3">
        <Button type="submit">Verificar correo</Button>
        <Button variant="ghost">Reenviar código</Button>
      </div>
    </form>
  </BrandShell>
);

/* ------------------------------------------------------------------ inicio */

function HomeShell({ children }: { children: ReactNode }) {
  return (
    <AppShell current="home" title="Inicio" user={user} primaryAction={newTransfer} onLogout={noop}>
      {children}
    </AppShell>
  );
}

const quickActions = (
  <QuickActions
    actions={[
      { key: 't', label: 'Transferir', icon: 'transfer', href: '#' },
      { key: 'm', label: 'Movimientos', icon: 'movements', href: '#' },
    ]}
  />
);

/** / — inicio con cuentas: hero, cuentas, límite diario y últimos movimientos. */
export const Home = () => (
  <HomeShell>
    <BalanceHero
      total={sumAmounts([principal.balance, ahorro.balance])}
      available={dailyLimit.remaining}
      actions={quickActions}
    />
    <div className="grid gap-5 dashboard:grid-cols-2">
      <div className="grid content-start gap-5">
        <section aria-label="Cuentas" className="grid gap-3">
          <AccountCard account={principal} selected onSelect={noop} />
          <AccountCard account={ahorro} onSelect={noop} />
        </section>
        <ListSection>
          <DailyLimitMeter dailyLimit={dailyLimit} />
        </ListSection>
      </div>
      <ListSection
        title="Últimos movimientos"
        action={
          <a href="#" className="inline-flex min-h-11 items-center text-label text-action">
            Ver todos
          </a>
        }
      >
        <MovementList movements={movements} now={NOW} />
      </ListSection>
    </div>
  </HomeShell>
);

/** / — sin cuentas (aún no se verifica el correo): total en cero y el límite completo. */
export const HomeEmpty = () => (
  <HomeShell>
    <BalanceHero total="0.00" available={dailyLimit.limit} />
    <EmptyState
      icon="account"
      title="Aún no tienes cuentas"
      description="Tus cuentas Principal y Ahorro se abren al verificar tu correo."
      action={<Button variant="secondary">Volver a cargar</Button>}
    />
  </HomeShell>
);

/** / — cargando: el hero, las dos cuentas y la lista como esqueletos. */
export const HomeLoading = () => (
  <HomeShell>
    <Skeleton variant="card" />
    <div className="grid gap-5 dashboard:grid-cols-2">
      <LoadingState label="Cargando tus cuentas" variant="card" count={2} />
      <ListSection>
        <LoadingState label="Cargando movimientos" count={4} />
      </ListSection>
    </div>
  </HomeShell>
);

/** / — la lectura falló (sin conexión): mensaje y "Reintentar". */
export const HomeError = () => (
  <HomeShell>
    <ErrorState
      title="No pudimos cargar tus cuentas"
      error={new TypeError('Failed to fetch')}
      onRetry={noop}
    />
  </HomeShell>
);

/* ------------------------------------------------------------------ movimientos */

function MovementsShell({ children }: { children: ReactNode }) {
  return (
    <AppShell
      current="movements"
      title="Movimientos"
      user={user}
      primaryAction={newTransfer}
      onLogout={noop}
    >
      {children}
    </AppShell>
  );
}

/**
 * Cuenta (control segmentado a dos mitades, como en la app móvil) y "Filtros". En teléfono los
 * filtros van en su propia fila; en el dashboard, a la derecha del selector.
 */
function MovementsToolbar() {
  return (
    <div className="grid gap-2 dashboard:flex dashboard:items-center dashboard:justify-between">
      <div role="group" aria-label="Cuenta" className="grid grid-cols-2 gap-2 dashboard:w-80">
        <button type="button" aria-pressed="true" className={buttonClasses('primary')}>
          {principal.name}
        </button>
        <button type="button" aria-pressed="false" className={buttonClasses('secondary')}>
          {ahorro.name}
        </button>
      </div>
      <Button variant="ghost" icon="filter" aria-haspopup="dialog" className="justify-self-end">
        Filtros
      </Button>
    </div>
  );
}

function MovementsHistory() {
  return (
    <>
      <MovementsToolbar />
      <ListSection>
        <MovementList movements={movements} now={NOW} />
      </ListSection>
      <Button variant="secondary" className="dashboard:justify-self-center">
        Cargar más
      </Button>
    </>
  );
}

/** /movements — historial de Principal agrupado por día, con "Cargar más". */
export const Movements = () => (
  <MovementsShell>
    <MovementsHistory />
  </MovementsShell>
);

/** /movements — los filtros no dejan resultados. */
export const MovementsEmpty = () => (
  <MovementsShell>
    <MovementsToolbar />
    <EmptyState
      icon="movements"
      title="No hay movimientos en este periodo"
      description="Prueba con otras fechas u otros tipos de movimiento."
      action={<Button variant="secondary">Limpiar filtros</Button>}
    />
  </MovementsShell>
);

/** /movements — "Filtros" abierto: fechas y tipos en la hoja inferior (panel en el dashboard). */
export const MovementsFilters = () => (
  <MovementsShell>
    <MovementsHistory />
    <KeepScroll>
      <BottomSheet open onClose={noop} title="Filtrar movimientos">
        <form noValidate className="grid gap-5">
          <div className="grid gap-4 dashboard:grid-cols-2 dashboard:gap-3">
            <TextField label="Desde" type="date" />
            <TextField label="Hasta" type="date" />
          </div>
          <fieldset className="grid">
            <legend className="pb-1 text-label text-fg">Tipo</legend>
            {MOVEMENT_TYPES.map((label) => (
              <label key={label} className="flex min-h-11 items-center gap-3 text-body text-fg">
                <input type="checkbox" className="size-5 accent-action" />
                {label}
              </label>
            ))}
          </fieldset>
          <div className="grid gap-3">
            <Button type="submit">Aplicar</Button>
            <Button variant="ghost">Limpiar</Button>
          </div>
        </form>
      </BottomSheet>
    </KeepScroll>
  </MovementsShell>
);

/* ------------------------------------------------------------------ flujo de transferencia */

interface Draft {
  to?: string;
  amount?: string;
  concept?: string;
  reference?: string;
  /** Más de $10,000.00: pide código por correo. */
  otp?: boolean;
  /** Comprobante: el intento terminó, ya no se avisa del código. */
  final?: boolean;
  /** Lo que queda del límite diario (decimal); por omisión, el de los datos canónicos. */
  remaining?: string;
}

const DRAFT: Draft = {
  to: `${luis.alias} · ${mask(luis.clabe)}`,
  amount: '$1,250.00',
  concept: 'Renta',
  reference: '1',
};

const OTP_DRAFT: Draft = { ...DRAFT, amount: '$15,000.00', otp: true };

/** Aviso de la revisión cuando el monto pide código (review-view.tsx de la app móvil). */
const OTP_NOTICE =
  'Como el monto es mayor a $10,000.00, te enviaremos un código de confirmación a tu correo.';

/** Tras enviar los $1,250.00 el límite baja a $30,250.00 (centavos con BigInt, nunca Number). */
const SENT_DRAFT: Draft = {
  ...DRAFT,
  final: true,
  remaining: centsToDecimalString(toCents(dailyLimit.remaining) - toCents(sentTransfer.amount)),
};

/** La transferencia con código falló: no se debitó nada y el límite sigue igual. */
const FAILED_DRAFT: Draft = { ...OTP_DRAFT, final: true };

/** Más que el saldo de Principal ($25,000.00): la API la rechaza con INSUFFICIENT_FUNDS. */
const OVER_BALANCE_DRAFT: Draft = { ...DRAFT, amount: '$30,000.00', otp: true };

/** Fila etiqueta / valor del resumen (revisión y panel lateral). */
function SummaryRow({ term, value }: { term: string; value: string | undefined }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 py-3">
      <dt className="text-body-sm text-fg-secondary">{term}</dt>
      <dd className={`text-right text-label tabular-nums ${value ? 'text-fg' : 'text-fg-muted'}`}>
        {value ?? 'Por definir'}
      </dd>
    </div>
  );
}

/** Resumen lateral del dashboard (WEB-30): lo que lleva capturado la transferencia. */
function Summary({ draft }: { draft: Draft }) {
  return (
    <ListSection title="Resumen" className="hidden self-start dashboard:block">
      <dl className="divide-y divide-border">
        <SummaryRow term="Desde" value={`${principal.name} · ${mask(principal.clabe)}`} />
        <SummaryRow term="Para" value={draft.to} />
        <SummaryRow term="Monto" value={draft.amount} />
        <SummaryRow term="Concepto" value={draft.concept} />
        <SummaryRow term="Referencia" value={draft.reference} />
      </dl>
      <p className="border-t border-border pt-3 text-caption text-fg-muted">
        {draft.otp && !draft.final
          ? OTP_NOTICE
          : `Te quedan ${formatMXN(draft.remaining ?? dailyLimit.remaining)} de tu límite diario de hoy.`}
      </p>
    </ListSection>
  );
}

/**
 * Acciones del paso. En teléfono quedan fijas abajo con un borde superior, como el `footer` de
 * Screen en la app móvil; el espaciador reserva su alto para que no tapen el contenido. En el
 * dashboard van en línea, debajo del paso.
 */
function StepActions({ children, stacked = false }: { children: ReactNode; stacked?: boolean }) {
  return (
    <>
      <div aria-hidden="true" className={`${stacked ? 'h-36' : 'h-21'} dashboard:hidden`} />
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface-canvas px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] dashboard:static dashboard:border-0 dashboard:bg-transparent dashboard:p-0">
        <div className="mx-auto grid max-w-app gap-3 dashboard:mx-0 dashboard:flex dashboard:max-w-none">
          {children}
        </div>
      </div>
    </>
  );
}

interface FlowPageProps {
  /** Título del paso (el h1 de la página), como en la app móvil. */
  title: string;
  step: number;
  total: number;
  stepLabel: string;
  draft: Draft;
  actions?: ReactNode;
  stackedActions?: boolean;
  children: ReactNode;
}

/** /transfers/new — un paso del flujo (WEB-30): sin pestañas en teléfono, resumen al lado en el dashboard. */
function FlowPage({
  title,
  step,
  total,
  stepLabel,
  draft,
  actions,
  stackedActions,
  children,
}: FlowPageProps) {
  return (
    <AppShell current="transfer" title="Transferir" user={user} mode="flow" onLogout={noop}>
      <FlowHeader title={title} step={step} total={total} stepLabel={stepLabel} closeHref="#" />
      <div className="grid gap-8 dashboard:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid content-start gap-5">
          {children}
          {actions ? <StepActions stacked={stackedActions}>{actions}</StepActions> : null}
        </div>
        <Summary draft={draft} />
      </div>
    </AppShell>
  );
}

/** Fila de destino: botón a todo lo ancho con avatar, nombre, detalle y flecha. */
function RecipientOption({
  avatar,
  label,
  description,
}: {
  avatar: ReactNode;
  label: string;
  description: string;
}) {
  return (
    <li>
      <button type="button" className="flex min-h-16 w-full items-center gap-3 py-3 text-left">
        {avatar}
        <span className="grid min-w-0 flex-1 gap-1">
          <span className="truncate text-label text-fg">{label}</span>
          <span className="truncate text-caption text-fg-secondary">{description}</span>
        </span>
        <Icon name="forward" className="text-fg-muted" />
      </button>
    </li>
  );
}

/** Paso 1: cuentas propias y beneficiarios. */
export const TransferRecipient = () => (
  <FlowPage title="¿A quién le envías?" step={1} total={5} stepLabel="Destinatario" draft={{}}>
    <ListSection title="Tus cuentas">
      <ul className="divide-y divide-border">
        <RecipientOption
          avatar={<Avatar icon="ownTransfer" />}
          label={ahorro.name}
          description={`CLABE ${mask(ahorro.clabe)} · $10,000.00`}
        />
      </ul>
    </ListSection>
    <ListSection title="Beneficiarios">
      <ul className="divide-y divide-border">
        {[luis, mama].map((beneficiary) => (
          <RecipientOption
            key={beneficiary.id}
            avatar={<Avatar initials={initials(beneficiary.name)} />}
            label={beneficiary.alias}
            description={`${beneficiary.name} · CLABE ${mask(beneficiary.clabe)}`}
          />
        ))}
      </ul>
    </ListSection>
  </FlowPage>
);

/** Paso 2: a quién, el monto grande, la cuenta de origen, el concepto y la referencia. */
export const TransferAmount = () => (
  <FlowPage
    title="¿Cuánto envías?"
    step={2}
    total={5}
    stepLabel="Monto"
    draft={DRAFT}
    actions={<Button type="submit">Continuar</Button>}
  >
    <ListSection>
      <div className="flex min-h-11 items-center gap-3 py-3">
        <Avatar initials={initials(luis.name)} />
        <div className="grid min-w-0 flex-1 gap-1">
          <p className="text-caption text-fg-secondary">Para</p>
          <p className="truncate text-label text-fg">
            {luis.alias} · CLABE {mask(luis.clabe)}
          </p>
        </div>
      </div>
    </ListSection>
    {/* El mismo monto tecleado que en la historia móvil (la web también acepta "1,250.00"). */}
    <AmountField
      variant="hero"
      label="Monto"
      defaultValue="1250.00"
      hint="Hasta 2 decimales, por ejemplo 1,250.50."
    />
    <Select label="Cuenta de origen" defaultValue={principal.id} hint="Saldo disponible: $25,000.00">
      <option value="">Elige una cuenta</option>
      <option value={principal.id}>Principal · $25,000.00</option>
      <option value={ahorro.id}>Ahorro · $10,000.00</option>
    </Select>
    <TextField label="Concepto" hint="Hasta 40 caracteres." autoComplete="off" defaultValue="Renta" />
    <TextField
      label="Referencia"
      inputMode="numeric"
      hint="Hasta 7 dígitos."
      autoComplete="off"
      defaultValue="1"
    />
  </FlowPage>
);

/** El monto protagonista de la revisión y del código. */
function AmountBlock({ amount, caption }: { amount: string | undefined; caption?: string }) {
  return (
    <div className="grid justify-items-center gap-1 py-2 text-center">
      <p className="text-label text-fg-secondary">Monto</p>
      <p className="text-display text-fg tabular-nums">{amount}</p>
      {caption ? <p className="text-body-sm text-fg-secondary">{caption}</p> : null}
    </div>
  );
}

/**
 * Resumen del intento de ConfirmStep: el monto, las filas Desde/Para/Concepto/Referencia y, si el
 * monto pide código, el aviso de que se enviará uno por correo.
 */
function ReviewSummary({ draft }: { draft: Draft }) {
  return (
    <>
      <AmountBlock amount={draft.amount} />
      <ListSection>
        <dl className="divide-y divide-border">
          <SummaryRow term="Desde" value={`${principal.name} · ${mask(principal.clabe)}`} />
          <SummaryRow term="Para" value={draft.to} />
          <SummaryRow term="Concepto" value={draft.concept} />
          <SummaryRow term="Referencia" value={draft.reference} />
        </dl>
      </ListSection>
      {draft.otp ? <InlineAlert tone="info">{OTP_NOTICE}</InlineAlert> : null}
    </>
  );
}

const REVIEW = { step: 3, total: 4, stepLabel: 'Revisión', draft: DRAFT } as const;

/** Paso 3 de 4 (sin código): revisión con "Enviar" y "Editar". */
export const TransferReview = () => (
  <FlowPage
    {...REVIEW}
    title="Revisa tu transferencia"
    stackedActions
    actions={
      <>
        <Button>Enviar</Button>
        <Button variant="ghost">Editar</Button>
      </>
    }
  >
    <ReviewSummary draft={DRAFT} />
  </FlowPage>
);

/** Revisión sin respuesta (red o 5xx): ni éxito ni falla; solo se reintenta, con la misma llave. */
export const TransferUncertain = () => (
  <FlowPage {...REVIEW} title="Estado sin confirmar" actions={<Button>Reintentar</Button>}>
    <ReviewSummary draft={DRAFT} />
    <InlineAlert tone="warning" title="No pudimos confirmar el estado de tu transferencia">
      Puede que se haya realizado. Reintenta para conocer el resultado: no se enviará dos veces.
    </InlineAlert>
  </FlowPage>
);

/**
 * Revisión rechazada por la API (INSUFFICIENT_FUNDS): $30,000.00 contra los $25,000.00 de
 * Principal. Al pasar de $10,000.00 el flujo lleva código, así que es el paso 3 de 5.
 */
export const TransferRejected = () => (
  <FlowPage
    title="Transferencia rechazada"
    step={3}
    total={5}
    stepLabel="Revisión"
    draft={OVER_BALANCE_DRAFT}
    actions={<Button variant="secondary">Corregir</Button>}
  >
    <ReviewSummary draft={OVER_BALANCE_DRAFT} />
    <InlineAlert tone="danger">No tienes saldo suficiente para esta transferencia.</InlineAlert>
  </FlowPage>
);

/** Paso 4 de 5: el código por correo de la transferencia de $15,000.00 (3 intentos). */
export const TransferOtp = () => (
  <FlowPage
    title="Confirma con tu código"
    step={4}
    total={5}
    stepLabel="Código"
    draft={OTP_DRAFT}
    stackedActions
    actions={
      <>
        <Button type="submit">Confirmar</Button>
        <Button variant="ghost">Reenviar código</Button>
      </>
    }
  >
    <AmountBlock amount={OTP_DRAFT.amount} caption={`Para ${luis.alias} · CLABE ${mask(luis.clabe)}`} />
    <div className="grid gap-4">
      <p className="text-body text-fg">Te enviamos un código de 6 dígitos a an***@example.com.</p>
      <div className="grid gap-1 text-body-sm text-fg-secondary tabular-nums">
        <p>Vence a las 12:05.</p>
        <p>Te quedan 3 intentos.</p>
      </div>
      <OtpField label="Código de 6 dígitos" defaultValue="482913" />
    </div>
  </FlowPage>
);

/** Paso 4 de 4: el comprobante de la transferencia completada. */
export const TransferCompleted = () => (
  <FlowPage
    title="Transferencia enviada"
    step={4}
    total={4}
    stepLabel="Comprobante"
    draft={SENT_DRAFT}
    stackedActions
    actions={
      <>
        <a href="#" className={buttonClasses('secondary')}>
          Ver mis cuentas
        </a>
        <Button variant="ghost">Hacer otra transferencia</Button>
      </>
    }
  >
    <Receipt transfer={sentTransfer} fromAccount={principal} />
  </FlowPage>
);

/** Paso 5 de 5: se agotaron los intentos del código y la transferencia se canceló. */
export const TransferFailed = () => (
  <FlowPage
    title="La transferencia no se realizó"
    step={5}
    total={5}
    stepLabel="Comprobante"
    draft={FAILED_DRAFT}
    stackedActions
    actions={
      <>
        <Button>Intentar de nuevo</Button>
        <a href="#" className={buttonClasses('secondary')}>
          Ver mis cuentas
        </a>
      </>
    }
  >
    <InlineAlert tone="danger">Agotaste los intentos. Cancelamos la transferencia.</InlineAlert>
    <Receipt transfer={failedTransfer} fromAccount={principal} />
  </FlowPage>
);

/* ------------------------------------------------------------------ beneficiarios */

function BeneficiariesShell({ children }: { children: ReactNode }) {
  return (
    <AppShell
      current="beneficiaries"
      title="Beneficiarios"
      user={user}
      primaryAction={addBeneficiary}
      onLogout={noop}
    >
      {children}
    </AppShell>
  );
}

/** /beneficiaries — la lista (ordenada por alias); en teléfono, "Agregar" va arriba. */
export const Beneficiaries = () => (
  <BeneficiariesShell>
    <a href="#" className={buttonClasses('primary', 'dashboard:hidden')}>
      Agregar beneficiario
    </a>
    <ListSection>
      <ul aria-label="Beneficiarios" className="divide-y divide-border">
        {[luis, mama].map((beneficiary) => (
          <li key={beneficiary.id} className="flex items-center gap-3 py-3">
            <Avatar initials={initials(beneficiary.name)} />
            {/* El nombre completo pasa a otra línea en lugar de cortarse (WEB-25). */}
            <div className="grid min-w-0 flex-1 gap-1">
              <p className="text-label text-fg">{beneficiary.alias}</p>
              <p className="text-body-sm text-fg-secondary">{beneficiary.name}</p>
              <p className="text-caption text-fg-muted tabular-nums">
                CLABE {mask(beneficiary.clabe)}
              </p>
            </div>
            <a
              href="#"
              aria-label={`Transferir a ${beneficiary.alias}`}
              className={buttonClasses('secondary', 'shrink-0')}
            >
              Transferir
            </a>
          </li>
        ))}
      </ul>
    </ListSection>
  </BeneficiariesShell>
);

/** /beneficiaries — sin beneficiarios. */
export const BeneficiariesEmpty = () => (
  <BeneficiariesShell>
    <EmptyState
      icon="beneficiaries"
      title="Aún no tienes beneficiarios"
      description="Agrega con su CLABE a las personas a las que les envías dinero."
      action={
        <a href="#" className={buttonClasses('secondary')}>
          Agregar beneficiario
        </a>
      }
    />
  </BeneficiariesShell>
);

/** /beneficiaries/new — NewBeneficiaryForm; en el dashboard va en un panel. */
export const NewBeneficiary = () => (
  <AppShell
    current="beneficiaries"
    title="Agregar beneficiario"
    user={user}
    primaryAction={newTransfer}
    onLogout={noop}
  >
    <form
      noValidate
      className="grid gap-5 dashboard:max-w-xl dashboard:rounded-lg dashboard:bg-surface dashboard:p-8 dashboard:shadow-card"
    >
      <TextField label="Nombre del titular" autoComplete="off" />
      <TextField
        label="Alias"
        hint="Así lo verás al transferir. Máximo 30 caracteres."
        autoComplete="off"
      />
      <TextField
        label="CLABE"
        inputMode="numeric"
        autoComplete="off"
        hint="18 dígitos, de una cuenta de TreoWallet."
        className="tabular-nums"
      />
      <div className="grid gap-3 pt-1">
        <Button type="submit">Agregar beneficiario</Button>
        <a href="#" className={buttonClasses('ghost')}>
          Cancelar
        </a>
      </div>
    </form>
  </AppShell>
);

/* ------------------------------------------------------------------ detalle */

/**
 * /transfers/[transferId] — TransferDetailScreen de una transferencia completada (la del
 * movimiento mv-1). Ninguna pestaña queda marcada: la ruta no es un destino de la navegación.
 */
export const TransferDetail = () => (
  <AppShell
    current={null}
    title="Transferencia"
    user={user}
    primaryAction={newTransfer}
    onLogout={noop}
  >
    <div className="grid gap-5 dashboard:max-w-2xl">
      <Receipt transfer={sentTransfer} fromAccount={principal} />
      <a href="#" className={buttonClasses('secondary', 'dashboard:justify-self-start')}>
        Ver mis cuentas
      </a>
    </div>
  </AppShell>
);
