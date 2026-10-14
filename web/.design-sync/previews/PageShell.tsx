import {
  AccountCard,
  AmountField,
  Button,
  DailyLimitMeter,
  EmptyState,
  InlineAlert,
  MovementRow,
  OtpField,
  PageShell,
  Receipt,
  Select,
  StepHeading,
  TextField,
  buttonClasses,
} from 'wallet-web-ui';

/*
 * Mapa de pantallas de la web: una historia por ruta y por estado de página completa, tal como la
 * renderiza la app (layouts de app/(public) y app/(app) + el componente de pantalla). Los datos son
 * los de test/fixtures.ts; los montos, las CLABE enmascaradas y las horas van ya formateados como
 * los dejan formatMXN, maskClabe y formatTime (hora de Ciudad de México).
 *
 * Los títulos de paso usan `focus={false}`: en un lienzo con varias celdas el foco movería el scroll.
 */

/* ------------------------------------------------------------------ datos (test/fixtures.ts) */

const PRINCIPAL = {
  id: '0b7d6f5e-4c3b-4a29-8187-6f5e4d3c2b1a',
  name: 'Principal',
  clabe: '032180000118359719',
  balance: '25000.00',
  currency: 'MXN' as const,
  createdAt: '2026-10-01T15:00:00.000Z',
};

const AHORRO = {
  id: '1c8e7a6f-5d4c-4b3a-9298-7a6f5e4d3c2b',
  name: 'Ahorro',
  clabe: '032180000118359722',
  balance: '10000.00',
  currency: 'MXN' as const,
  createdAt: '2026-10-01T15:00:00.000Z',
};

const ACCOUNTS = [PRINCIPAL, AHORRO];

const DAILY_LIMIT = {
  limit: '50000.00',
  used: '12000.00',
  remaining: '38000.00',
  resetsAt: '2026-10-14T06:00:00.000Z',
  timeZone: 'America/Mexico_City' as const,
};

const BENEFICIARY = {
  id: '2d9f8b7a-6e5d-4c4b-8a39-8b7a6f5e4d3c',
  name: 'Luis Pérez Ramírez',
  alias: 'Luis',
  clabe: '032180000118359735',
  createdAt: '2026-10-02T18:00:00.000Z',
};

/* La API los devuelve ordenados por alias (es-MX). */
const BENEFICIARIES = [
  BENEFICIARY,
  {
    id: '5a1c3e5f-7b9d-4f1a-8c3e-5f7b9d1f3a5c',
    name: 'Mariana López Ortega',
    alias: 'Mariana',
    clabe: '032180000118354410',
    createdAt: '2026-10-04T17:20:00.000Z',
  },
  {
    id: '6b2d4f6a-8c0e-4a2b-9d4f-6a8c0e2a4b6d',
    name: 'Sofía Hernández Cruz',
    alias: 'Sofía',
    clabe: '032180000118352286',
    createdAt: '2026-10-06T20:05:00.000Z',
  },
];

type MovementType = 'DEPOSIT' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'OWN_TRANSFER_IN' | 'OWN_TRANSFER_OUT';

interface Movement {
  id: string;
  type: MovementType;
  amount: string;
  balanceAfter: string;
  concept: string;
  reference: string;
  counterparty: { name: string; clabeLast4: string } | null;
  transferId: string;
  occurredAt: string;
}

function movement(overrides: Partial<Movement> = {}): Movement {
  return {
    id: 'mov-1',
    type: 'TRANSFER_IN',
    amount: '1500.00',
    balanceAfter: '26500.00',
    concept: 'Renta de octubre',
    reference: '1234',
    counterparty: { name: 'Luis Pérez', clabeLast4: '9735' },
    transferId: '3e0a9c8b-7f6e-4d5c-8b4a-9c8b7a6f5e4d',
    occurredAt: '2026-10-13T16:42:00.000Z',
    ...overrides,
  };
}

/* Primera página del historial de Principal (más reciente primero; el saldo cuadra entre filas). */
const MOVEMENTS: Movement[] = [
  movement({
    id: 'm1',
    type: 'TRANSFER_OUT',
    amount: '-5000.00',
    balanceAfter: '25000.00',
    concept: 'Renta',
    reference: '1',
    counterparty: { name: 'Luis', clabeLast4: '9735' },
    transferId: '4f1b0d9c-8a7f-4e6d-9c5b-0d9c8b7a6f5e',
    occurredAt: '2026-10-13T16:42:01.000Z',
  }),
  movement({ id: 'm2', balanceAfter: '30000.00', occurredAt: '2026-10-12T16:42:00.000Z' }),
  movement({
    id: 'm3',
    type: 'TRANSFER_OUT',
    amount: '-850.50',
    balanceAfter: '28500.00',
    concept: 'Despensa',
    reference: '2048',
    counterparty: { name: 'Mariana', clabeLast4: '4410' },
    transferId: '7b2d4f6a-8c0e-4a1b-9d3f-5e7a9c1b3d5f',
    occurredAt: '2026-10-11T23:15:00.000Z',
  }),
  movement({
    id: 'm4',
    type: 'OWN_TRANSFER_OUT',
    amount: '-2500.00',
    balanceAfter: '29350.50',
    concept: 'Ahorro quincenal',
    reference: '15',
    counterparty: { name: 'Ahorro', clabeLast4: '9722' },
    transferId: '9a2c4e6f-1b3d-4f5a-8c7e-2d4f6a8b0c1e',
    occurredAt: '2026-10-10T15:05:00.000Z',
  }),
  movement({
    id: 'm5',
    type: 'TRANSFER_OUT',
    amount: '-1200.00',
    balanceAfter: '31850.50',
    concept: 'Clases de inglés',
    reference: '8',
    counterparty: { name: 'Sofía', clabeLast4: '2286' },
    transferId: '5c7e9a1b-3d5f-4b7c-9e1a-3b5d7f9a1c3e',
    occurredAt: '2026-10-08T19:30:00.000Z',
  }),
];

function transfer(overrides = {}) {
  return {
    id: '4f1b0d9c-8a7f-4e6d-9c5b-0d9c8b7a6f5e',
    status: 'COMPLETED' as const,
    kind: 'THIRD_PARTY' as const,
    fromAccountId: PRINCIPAL.id,
    destination: {
      type: 'BENEFICIARY' as const,
      accountId: null,
      beneficiaryId: BENEFICIARY.id,
      displayName: 'Luis',
      clabeLast4: '9735',
    },
    amount: '5000.00',
    concept: 'Renta',
    reference: '1',
    requiresOtp: false,
    otp: null,
    rejectionReason: null,
    failureReason: null,
    createdAt: '2026-10-13T16:42:00.000Z',
    completedAt: '2026-10-13T16:42:01.000Z' as string | null,
    ...overrides,
  };
}

/* La transferencia de $15,000.00 que pide código; tras confirmarlo queda COMPLETED. */
const OTP_CHALLENGE = {
  channel: 'EMAIL' as const,
  deliveryStatus: 'SENT' as const,
  maskedDestination: 'an***@example.com',
  expiresAt: '2026-10-13T16:52:00.000Z',
  attemptsRemaining: 3,
  resendsRemaining: 3,
};

const CONFIRMED_OTP_TRANSFER = transfer({
  id: '8a3e6c1d-2f4b-4c7e-9a1d-3e6c1d2f4b7a',
  amount: '15000.00',
  requiresOtp: true,
  completedAt: '2026-10-13T16:43:10.000Z',
});

/* ------------------------------------------------------------------ helpers de presentación */

/** maskClabe de lib/money.ts. */
const mask = (clabe: string) => `•••• ${clabe.slice(-4)}`;

const MOVEMENT_TYPES: Array<[MovementType, string]> = [
  ['DEPOSIT', 'Depósito'],
  ['TRANSFER_IN', 'Transferencia recibida'],
  ['TRANSFER_OUT', 'Transferencia enviada'],
  ['OWN_TRANSFER_IN', 'Traspaso recibido'],
  ['OWN_TRANSFER_OUT', 'Traspaso enviado'],
];

/* ------------------------------------------------------------------ encabezado con sesión */

const NAV_ITEM = 'inline-flex min-h-11 items-center rounded-pill px-4 text-label';

type Section = 'Cuentas' | 'Beneficiarios' | 'Transferir' | null;

/** AppNav de components/layout/AppHeader.tsx; `current` es la sección con aria-current. */
function AppNav({ current }: { current: Section }) {
  return (
    <nav aria-label="Principal">
      <ul className="flex flex-wrap gap-1">
        {(['Cuentas', 'Beneficiarios', 'Transferir'] as const).map((label) => (
          <li key={label}>
            <a
              href="#"
              aria-current={label === current ? 'page' : undefined}
              className={`${NAV_ITEM} ${
                label === current ? 'bg-surface-brand text-action' : 'text-fg-secondary hover:text-action'
              }`}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Layout de app/(app): AppNav + LogoutButton en `actions`. */
const appActions = (current: Section) => (
  <>
    <AppNav current={current} />
    <Button variant="secondary">Cerrar sesión</Button>
  </>
);

/** Layout de app/(public): el contenido va centrado en max-w-md. */
function PublicPage({ children }: { children: React.ReactNode }) {
  return (
    <PageShell>
      <div className="mx-auto grid w-full max-w-md gap-6">{children}</div>
    </PageShell>
  );
}

/* ------------------------------------------------------------------ públicas */

/** /login — LoginForm. */
export const LoginPage = () => (
  <PublicPage>
    <h1 className="text-h1">Inicia sesión</h1>
    <form noValidate className="grid gap-5">
      <TextField label="Correo" type="email" autoComplete="email" />
      <TextField label="Contraseña" type="password" autoComplete="current-password" />
      <Button type="submit">Iniciar sesión</Button>
      <p className="text-body-sm text-fg-secondary">
        ¿No tienes cuenta?{' '}
        <a href="#" className="text-action underline underline-offset-2">
          Regístrate
        </a>
      </p>
    </form>
  </PublicPage>
);

/** /register — RegisterForm. */
export const RegisterPage = () => (
  <PublicPage>
    <h1 className="text-h1">Crea tu cuenta</h1>
    <form noValidate className="grid gap-5">
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
      <Button type="submit">Crear cuenta</Button>
      <p className="text-body-sm text-fg-secondary">
        ¿Ya tienes cuenta?{' '}
        <a href="#" className="text-action underline underline-offset-2">
          Inicia sesión
        </a>
      </p>
    </form>
  </PublicPage>
);

/** /verify-email?email=…&registered=1 — VerifyEmailForm al llegar del registro. */
export const VerifyEmailPage = () => (
  <PublicPage>
    <h1 className="text-h1">Verifica tu correo</h1>
    <form noValidate className="grid gap-5">
      <InlineAlert tone="info">
        Si los datos son correctos, recibirás un correo con las instrucciones.
      </InlineAlert>
      <TextField label="Correo" type="email" autoComplete="email" defaultValue="ana@example.com" />
      <OtpField label="Código de 6 dígitos" hint="Lo enviamos a tu correo. Vence en 15 minutos." />
      <div className="flex flex-wrap gap-3">
        <Button type="submit">Verificar correo</Button>
        <Button variant="ghost">Reenviar código</Button>
      </div>
    </form>
  </PublicPage>
);

/* ------------------------------------------------------------------ cuentas */

function AccountsHeader() {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <h1 className="text-h1">Tus cuentas</h1>
      <a href="#" className={buttonClasses('primary')}>
        Nueva transferencia
      </a>
    </div>
  );
}

/** / — AccountsOverviewScreen con cuentas. */
export const AccountsPage = () => (
  <PageShell actions={appActions('Cuentas')}>
    <div className="grid gap-8">
      <AccountsHeader />
      <section aria-labelledby="daily-limit-title" className="grid gap-3">
        <h2 id="daily-limit-title" className="text-h3">
          Límite diario de transferencias
        </h2>
        <DailyLimitMeter dailyLimit={DAILY_LIMIT} />
      </section>
      <section aria-label="Cuentas" className="grid gap-4 sm:grid-cols-2">
        {ACCOUNTS.map((account) => (
          <AccountCard key={account.id} account={account}>
            <a
              href="#"
              aria-label={`Ver movimientos de ${account.name}`}
              className={buttonClasses('secondary')}
            >
              Ver movimientos
            </a>
            <a
              href="#"
              aria-label={`Transferir desde ${account.name}`}
              className={buttonClasses('ghost')}
            >
              Transferir
            </a>
          </AccountCard>
        ))}
      </section>
    </div>
  </PageShell>
);

/** / — AccountsOverviewScreen sin cuentas (aún no se verifica el correo). */
export const AccountsEmpty = () => (
  <PageShell actions={appActions('Cuentas')}>
    <div className="grid gap-8">
      <AccountsHeader />
      <EmptyState
        title="Aún no tienes cuentas"
        description="Tus cuentas Principal y Ahorro se abren al verificar tu correo."
        action={<Button variant="secondary">Volver a cargar</Button>}
      />
    </div>
  </PageShell>
);

/* ------------------------------------------------------------------ movimientos */

function MovementFilters({ from = '', to = '' }: { from?: string; to?: string }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Select label="Cuenta" defaultValue={PRINCIPAL.id}>
          {ACCOUNTS.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </Select>
        <TextField label="Desde" type="date" defaultValue={from} max={to || undefined} />
        <TextField label="Hasta" type="date" defaultValue={to} min={from || undefined} />
      </div>
      <fieldset className="grid gap-2">
        <legend className="text-label text-fg">Tipo</legend>
        <div className="flex flex-wrap gap-x-4">
          {MOVEMENT_TYPES.map(([type, label]) => (
            <label key={type} className="inline-flex min-h-11 items-center gap-2 text-body-sm">
              <input type="checkbox" className="size-4 accent-action" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}

/** /accounts/[accountId]/movements — MovementsScreen con la primera página y "Cargar más". */
export const MovementsPage = () => (
  <PageShell actions={appActions('Cuentas')}>
    <div className="grid gap-6">
      <h1 className="text-h1">Movimientos</h1>
      <MovementFilters />
      <section className="grid gap-4">
        <ul aria-label="Movimientos">
          {MOVEMENTS.map((item) => (
            <MovementRow key={item.id} movement={item} />
          ))}
        </ul>
        <div>
          <Button variant="secondary">Cargar más</Button>
        </div>
      </section>
    </div>
  </PageShell>
);

/** /accounts/[accountId]/movements — filtros sin resultados ("Limpiar filtros"). */
export const MovementsEmpty = () => (
  <PageShell actions={appActions('Cuentas')}>
    <div className="grid gap-6">
      <h1 className="text-h1">Movimientos</h1>
      <MovementFilters from="2026-09-01" to="2026-09-30" />
      <EmptyState
        title="No hay movimientos en este periodo"
        description="Prueba con otras fechas u otros tipos de movimiento."
        action={<Button variant="secondary">Limpiar filtros</Button>}
      />
    </div>
  </PageShell>
);

/* ------------------------------------------------------------------ beneficiarios */

function BeneficiariesHeader() {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <h1 className="text-h1">Beneficiarios</h1>
      <a href="#" className={buttonClasses('primary')}>
        Agregar beneficiario
      </a>
    </div>
  );
}

/** /beneficiaries — BeneficiariesScreen con la lista. */
export const BeneficiariesPage = () => (
  <PageShell actions={appActions('Beneficiarios')}>
    <div className="grid gap-6">
      <BeneficiariesHeader />
      <ul aria-label="Beneficiarios" className="grid gap-3">
        {BENEFICIARIES.map((beneficiary) => (
          <li
            key={beneficiary.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface-subtle p-4"
          >
            <div className="grid gap-0.5">
              <p className="text-label text-fg">{beneficiary.alias}</p>
              <p className="text-body-sm text-fg-secondary">{beneficiary.name}</p>
              <p className="text-caption text-fg-muted tabular-nums">
                CLABE {mask(beneficiary.clabe)}
              </p>
            </div>
            <a
              href="#"
              aria-label={`Transferir a ${beneficiary.alias}`}
              className={buttonClasses('secondary')}
            >
              Transferir
            </a>
          </li>
        ))}
      </ul>
    </div>
  </PageShell>
);

/** /beneficiaries — BeneficiariesScreen sin beneficiarios. */
export const BeneficiariesEmpty = () => (
  <PageShell actions={appActions('Beneficiarios')}>
    <div className="grid gap-6">
      <BeneficiariesHeader />
      <EmptyState
        title="Aún no tienes beneficiarios"
        description="Agrega con su CLABE a las personas a las que les envías dinero."
        action={
          <a href="#" className={buttonClasses('secondary')}>
            Agregar beneficiario
          </a>
        }
      />
    </div>
  </PageShell>
);

/** /beneficiaries/new — NewBeneficiaryForm. */
export const NewBeneficiaryPage = () => (
  <PageShell actions={appActions('Beneficiarios')}>
    <div className="mx-auto grid w-full max-w-md gap-6">
      <a href="#" className="text-body-sm text-action underline underline-offset-2">
        Volver a beneficiarios
      </a>
      <h1 className="text-h1">Agregar beneficiario</h1>
      <form noValidate className="grid gap-5">
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
        <Button type="submit">Agregar beneficiario</Button>
      </form>
    </div>
  </PageShell>
);

/* ------------------------------------------------------------------ transferencias */

/** /transfers/new — página de TransferFlow (sección "Transferir" actual). */
function NewTransferPage({ children }: { children: React.ReactNode }) {
  return (
    <PageShell actions={appActions('Transferir')}>
      <div className="mx-auto grid w-full max-w-xl gap-6">
        <h1 className="text-h1">Nueva transferencia</h1>
        {children}
      </div>
    </PageShell>
  );
}

/** Fila del resumen de ConfirmStep. */
function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 border-b border-border py-3 sm:grid-cols-3 sm:gap-4">
      <dt className="text-body-sm text-fg-secondary">{term}</dt>
      <dd className="text-body text-fg sm:col-span-2">{children}</dd>
    </div>
  );
}

function ConfirmSummary({ amount }: { amount: string }) {
  return (
    <dl className="rounded-lg bg-surface p-6 shadow-card">
      <Row term="Monto">
        <span className="text-h3 tabular-nums">{amount}</span>
      </Row>
      <Row term="Origen">
        {PRINCIPAL.name} {mask(PRINCIPAL.clabe)}
      </Row>
      <Row term="Destino">
        {BENEFICIARY.alias} {mask(BENEFICIARY.clabe)}
      </Row>
      <Row term="Concepto">Renta</Row>
      <Row term="Referencia">1</Row>
    </dl>
  );
}

/** Paso "form": TransferForm con el borrador escrito (origen Principal, beneficiario Luis). */
export const TransferFormPage = () => (
  <NewTransferPage>
    <form noValidate className="grid gap-5">
      <Select
        label="Cuenta de origen"
        hint="Saldo disponible: $25,000.00"
        defaultValue={PRINCIPAL.id}
      >
        <option value="">Elige una cuenta</option>
        <option value={PRINCIPAL.id}>Principal · $25,000.00</option>
        <option value={AHORRO.id}>Ahorro · $10,000.00</option>
      </Select>

      <fieldset className="grid gap-2">
        <legend className="text-label text-fg">Destino</legend>
        <div className="flex flex-wrap gap-x-6">
          <label className="inline-flex min-h-11 items-center gap-2 text-body">
            <input
              type="radio"
              name="destinationType"
              value="OWN_ACCOUNT"
              className="size-4 accent-action"
            />
            Mis cuentas
          </label>
          <label className="inline-flex min-h-11 items-center gap-2 text-body">
            <input
              type="radio"
              name="destinationType"
              value="BENEFICIARY"
              defaultChecked
              className="size-4 accent-action"
            />
            Un beneficiario
          </label>
        </div>
      </fieldset>

      <div className="grid gap-2">
        <Select label="Beneficiario" defaultValue={BENEFICIARY.id}>
          <option value="">Elige un beneficiario</option>
          {BENEFICIARIES.map((beneficiary) => (
            <option key={beneficiary.id} value={beneficiary.id}>
              {beneficiary.alias} ({beneficiary.name}) {mask(beneficiary.clabe)}
            </option>
          ))}
        </Select>
      </div>

      <AmountField
        label="Monto"
        hint="Hasta 2 decimales, por ejemplo 1,250.50."
        defaultValue="15,000"
      />
      <TextField label="Concepto" hint="Hasta 40 caracteres." autoComplete="off" defaultValue="Renta" />
      <TextField
        label="Referencia"
        inputMode="numeric"
        hint="Hasta 7 dígitos."
        autoComplete="off"
        defaultValue="1"
      />
      <Button type="submit">Continuar</Button>
    </form>
  </NewTransferPage>
);

/** Paso "confirm" (status idle): resumen y Enviar / Editar. */
export const TransferConfirmPage = () => (
  <NewTransferPage>
    <section aria-labelledby="confirm-title" className="grid gap-5">
      <StepHeading id="confirm-title" focus={false}>
        Confirma la transferencia
      </StepHeading>
      <ConfirmSummary amount="$15,000.00" />
      <div className="flex flex-wrap gap-3">
        <Button>Enviar</Button>
        <Button variant="secondary">Editar</Button>
      </div>
    </section>
  </NewTransferPage>
);

/** Paso "confirm" rechazado por la API (INSUFFICIENT_FUNDS): saldo vigente y "Corregir". */
export const TransferInsufficientFundsPage = () => (
  <NewTransferPage>
    <section aria-labelledby="confirm-title" className="grid gap-5">
      <StepHeading id="confirm-title" focus={false}>
        Confirma la transferencia
      </StepHeading>
      <ConfirmSummary amount="$30,000.00" />
      <InlineAlert tone="danger" title="Saldo insuficiente">
        <p>No tienes saldo suficiente para esta transferencia.</p>
        <p>Saldo disponible en Principal: $25,000.00</p>
      </InlineAlert>
      <div className="flex flex-wrap gap-3">
        <Button>Corregir</Button>
      </div>
    </section>
  </NewTransferPage>
);

/** Paso "confirm" sin respuesta (red o 5xx): solo se ofrece reintentar con la misma llave. */
export const TransferUncertainPage = () => (
  <NewTransferPage>
    <section aria-labelledby="confirm-title" className="grid gap-5">
      <StepHeading id="confirm-title" focus={false}>
        Confirma la transferencia
      </StepHeading>
      <ConfirmSummary amount="$15,000.00" />
      <InlineAlert tone="danger" title="No sabemos si la transferencia se envió">
        Revisa tu conexión y reintenta: usamos el mismo identificador, así que no se enviará dos
        veces.
      </InlineAlert>
      <div className="flex flex-wrap gap-3">
        <Button>Reintentar</Button>
      </div>
    </section>
  </NewTransferPage>
);

/** Paso "otp": OtpStep con el código enviado por correo y reenvíos disponibles. */
export const TransferOtpPage = () => (
  <NewTransferPage>
    <div className="grid gap-5">
      <section aria-labelledby="otp-title" className="grid gap-5">
        <StepHeading id="otp-title" focus={false}>
          Ingresa el código
        </StepHeading>
        <p className="text-body text-fg-secondary">
          Te enviamos un código a {OTP_CHALLENGE.maskedDestination}. Vence a las 10:52.
        </p>
        <form noValidate className="grid gap-5">
          <OtpField label="Código de 6 dígitos" />
          <div className="flex flex-wrap gap-3">
            <Button type="submit">Confirmar</Button>
            <Button variant="ghost">Reenviar código</Button>
          </div>
        </form>
      </section>
    </div>
  </NewTransferPage>
);

/** Paso "receipt": ReceiptStep de la transferencia confirmada, con "Hacer otra transferencia". */
export const TransferReceiptPage = () => (
  <NewTransferPage>
    <div className="grid gap-5">
      <section aria-labelledby="receipt-step-title" className="grid gap-5">
        <StepHeading id="receipt-step-title" focus={false}>
          Transferencia enviada
        </StepHeading>
        <Receipt transfer={CONFIRMED_OTP_TRANSFER} fromAccount={PRINCIPAL} />
        <div className="flex flex-wrap gap-3">
          <a href="#" className={buttonClasses('secondary')}>
            Ver mis cuentas
          </a>
          <Button variant="ghost">Hacer otra transferencia</Button>
        </div>
      </section>
    </div>
  </NewTransferPage>
);

/** Paso "ended": EndedStep tras una revalidación rechazada (DAILY_LIMIT_EXCEEDED). */
export const TransferRejectedPage = () => (
  <NewTransferPage>
    <section aria-labelledby="ended-title" className="grid gap-5">
      <StepHeading id="ended-title" focus={false}>
        La transferencia no se realizó
      </StepHeading>
      <InlineAlert tone="danger" title="Superaste tu límite diario">
        Esta transferencia supera lo que te queda del límite de hoy. Hoy puedes enviar hasta
        $1,500.00.
      </InlineAlert>
      <div>
        <Button>Iniciar una nueva transferencia</Button>
      </div>
    </section>
  </NewTransferPage>
);

/**
 * /transfers/[transferId] — TransferDetailScreen de una transferencia completada: ReceiptStep sin
 * "Hacer otra transferencia". Ninguna sección del menú queda marcada (la ruta no es /transfers/new).
 */
export const TransferDetailPage = () => (
  <PageShell actions={appActions(null)}>
    <div className="mx-auto grid w-full max-w-xl gap-6">
      <h1 className="text-h1">Transferencia</h1>
      <section aria-labelledby="receipt-step-title" className="grid gap-5">
        <StepHeading id="receipt-step-title" focus={false}>
          Transferencia enviada
        </StepHeading>
        <Receipt transfer={transfer()} fromAccount={PRINCIPAL} />
        <div className="flex flex-wrap gap-3">
          <a href="#" className={buttonClasses('secondary')}>
            Ver mis cuentas
          </a>
        </div>
      </section>
    </div>
  </PageShell>
);
