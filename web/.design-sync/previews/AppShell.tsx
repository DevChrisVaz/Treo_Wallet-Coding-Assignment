import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
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
  SearchField,
  Select,
  Skeleton,
  StepActions,
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
 *
 * Funciones propias de la web (bonus, sin pareja móvil): el estado de cuenta en Movimientos (WEB-32,
 * R53), "Programar" en el flujo, su revisión y su resultado (WEB-33, R56) y la página "Programadas"
 * con su cancelación (WEB-34). Las fechas dependen de NOW, como en las pantallas reales con el reloj
 * fijo: el selector de meses y el rango programable no cambian con el día en que se abre el lienzo.
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

/**
 * La programada canónica (la que lista la API simulada): $1,000.00 a Luis para el 20 de octubre de
 * 2026, "Renta", ref. 1. Aún no mueve dinero.
 */
const scheduledTransfer = {
  ...sentTransfer,
  id: '9a3b5c7d-2e4f-4a6b-8c0d-1e3f5a7b9c2d',
  status: 'SCHEDULED' as const,
  amount: '1000.00',
  // WEB-33: instante RFC 3339 (20 de octubre de 2026, 14:30 en la Ciudad de México = 20:30 UTC).
  scheduledFor: '2026-10-20T20:30:00Z',
  cancelledAt: null,
  createdAt: '2026-10-13T16:50:00Z',
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

/** Errores de campo del registro (WEB-11): los mensajes del contrato, bajo cada campo. */
interface RegisterFieldErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  fullName?: string;
  curp?: string;
  rfc?: string;
  phone?: string;
}

/**
 * RegisterForm (WEB-11): validación al salir de cada campo (`mode: 'onTouched'`), "Confirmar contraseña"
 * solo en la interfaz (no se envía a la API) y entradas acotadas al teclear: CURP y RFC en mayúsculas
 * alfanuméricas (18 y 13), teléfono solo dígitos (10). Los campos de `values` van rellenos.
 */
function RegisterForm({
  values = {},
  errors = {},
}: {
  values?: Partial<Record<keyof RegisterFieldErrors, string>>;
  errors?: RegisterFieldErrors;
}) {
  return (
    <BrandShell title="Crea tu cuenta">
      <form noValidate className="grid gap-4">
        <TextField
          label="Correo"
          type="email"
          autoComplete="email"
          defaultValue={values.email}
          error={errors.email}
        />
        <TextField
          label="Contraseña"
          type="password"
          autoComplete="new-password"
          defaultValue={values.password}
          hint="De 12 a 128 caracteres, con al menos una letra y un número."
          error={errors.password}
        />
        {/* WEB-11: campo nuevo, solo de interfaz; debe coincidir con la contraseña. */}
        <TextField
          label="Confirmar contraseña"
          type="password"
          autoComplete="new-password"
          defaultValue={values.confirmPassword}
          error={errors.confirmPassword}
        />
        <TextField
          label="Nombre completo"
          autoComplete="name"
          defaultValue={values.fullName}
          hint="Nombre y apellido, solo letras."
          error={errors.fullName}
        />
        <TextField
          label="CURP"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={18}
          defaultValue={values.curp}
          hint="18 caracteres, como aparece en tu identificación."
          error={errors.curp}
        />
        <TextField
          label="RFC"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={13}
          defaultValue={values.rfc}
          hint="13 caracteres, con homoclave."
          error={errors.rfc}
        />
        <TextField
          label="Teléfono"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={10}
          defaultValue={values.phone}
          hint="10 dígitos, sin lada ni espacios."
          error={errors.phone}
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
}

/** /register — RegisterForm vacío, con el mismo ritmo que Login. */
export const Register = () => <RegisterForm />;

/**
 * /register tras salir de los campos (WEB-11): errores en línea de las reglas del contrato. El RFC no
 * coincide con los 10 primeros caracteres de la CURP; el nombre lleva un dígito; la confirmación no
 * coincide; el teléfono no empieza en 2 a 9.
 */
export const RegisterErrors = () => (
  <RegisterForm
    values={{
      email: 'ana@example.com',
      password: 'contraseña-segura1',
      confirmPassword: 'contraseña-segura2',
      fullName: 'Ana3 Gómez',
      curp: 'GOCA900515MDFMSN09',
      rfc: 'GOMA850101AB1',
      phone: '1555123456',
    }}
    errors={{
      confirmPassword: 'Las contraseñas no coinciden.',
      fullName: 'Usa solo letras, espacios, apóstrofo, guion o punto.',
      rfc: 'El RFC no coincide con tu CURP',
      phone: 'Escribe 10 dígitos; el primero va del 2 al 9.',
    }}
  />
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
      // WEB-35: "Recibir" va después de "Transferir", con la flecha
      // entrante (`moneyIn`), y abre la hoja "Recibir dinero".
      { key: 'r', label: 'Recibir', icon: 'moneyIn', onClick: noop },
      { key: 'm', label: 'Movimientos', icon: 'movements', href: '#' },
    ]}
  />
);

/**
 * El contenido de Inicio. WEB-28: la tarjeta de cuenta solo muestra la CLABE enmascarada (•••• 1234); ya
 * no hay "Mostrar CLABE": la CLABE completa solo está en "Recibir dinero".
 */
function HomeContent() {
  return (
    <>
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
            <DailyLimitMeter dailyLimit={dailyLimit} showHeader />
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
    </>
  );
}

/** / — inicio con cuentas: hero con "Recibir", cuentas con la CLABE enmascarada, límite y movimientos. */
export const Home = () => (
  <HomeShell>
    <HomeContent />
  </HomeShell>
);

/** CLABE de 18 dígitos en grupos de 4 para leerla (la copia va sin espacios). */
const groupClabe = (clabe: string) => clabe.replace(/(\d{4})(?=\d)/g, '$1 ');

/**
 * Hoja "Recibir dinero" (WEB-35: `components/accounts/ReceiveSheet.tsx`): selector de cuenta arriba (Principal /
 * Ahorro, la de Inicio preseleccionada), los datos para recibir (Titular, Banco, Cuenta, CLABE
 * completa en grupos) y "Copiar CLABE", que pasa a "CLABE copiada" con una confirmación anunciada
 * (`role="status"`). La web no tiene "Compartir" (solo móvil).
 */
function ReceiveSheet({ selected = principal, copied = false }: { selected?: typeof principal; copied?: boolean }) {
  const accounts = [principal, ahorro];
  const rows: [string, string][] = [
    ['Titular', user.name],
    ['Banco', 'TreoWallet'],
    ['Cuenta', selected.name],
  ];
  return (
    <KeepScroll>
      <BottomSheet open onClose={noop} title="Recibir dinero">
        <div className="grid gap-5">
          <div
            role="radiogroup"
            aria-label="Cuenta"
            className="grid grid-cols-2 gap-1 rounded-md bg-surface-subtle p-1"
          >
            {accounts.map((account) => {
              const on = account.id === selected.id;
              return (
                <button
                  key={account.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={`min-h-11 rounded-sm px-3 text-label transition-colors ${on ? 'bg-surface text-fg shadow-card' : 'text-fg-secondary hover:text-fg'}`}
                >
                  {account.name}
                </button>
              );
            })}
          </div>
          <dl className="divide-y divide-border">
            {rows.map(([term, value]) => (
              <SummaryRow key={term} term={term} value={value} />
            ))}
            <div className="grid gap-1 py-3">
              <dt className="text-body-sm text-fg-secondary">CLABE</dt>
              <dd className="text-h3 whitespace-nowrap text-fg tabular-nums">
                {groupClabe(selected.clabe)}
              </dd>
            </div>
          </dl>
          <div className="grid gap-3">
            <Button variant={copied ? 'primary' : 'secondary'} icon={copied ? 'check' : 'copy'}>
              {copied ? 'CLABE copiada' : 'Copiar CLABE'}
            </Button>
            <p role="status" className="sr-only">
              {copied ? 'CLABE copiada' : ''}
            </p>
          </div>
          <p className="text-caption text-fg-muted">
            Comparte estos datos para que te transfieran desde otra cuenta TreoWallet.
          </p>
        </div>
      </BottomSheet>
    </KeepScroll>
  );
}

/** "Recibir" abierto en Inicio: hoja en teléfono y panel centrado en el dashboard (ver a 390 y 1280). */
export const HomeReceive = () => (
  <HomeShell>
    <HomeContent />
    <ReceiveSheet />
  </HomeShell>
);

/** Tras "Copiar CLABE": el botón dice "CLABE copiada" (feedback que vuelve a la normalidad a los pocos segundos). */
export const HomeReceiveCopied = () => (
  <HomeShell>
    <HomeContent />
    <ReceiveSheet copied />
  </HomeShell>
);

/** El selector cambió a Ahorro: los datos de abajo son los de esa cuenta (cuenta y CLABE). */
export const HomeReceiveSavings = () => (
  <HomeShell>
    <HomeContent />
    <ReceiveSheet selected={ahorro} />
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

/** Mes en curso (de NOW) y los 12 anteriores, como statementMonths: octubre 2026 a octubre 2025. */
const STATEMENT_MONTHS = [
  ['2026-10', 'octubre 2026 (en curso)'],
  ['2026-09', 'septiembre 2026'],
  ['2026-08', 'agosto 2026'],
  ['2026-07', 'julio 2026'],
  ['2026-06', 'junio 2026'],
  ['2026-05', 'mayo 2026'],
  ['2026-04', 'abril 2026'],
  ['2026-03', 'marzo 2026'],
  ['2026-02', 'febrero 2026'],
  ['2026-01', 'enero 2026'],
  ['2025-12', 'diciembre 2025'],
  ['2025-11', 'noviembre 2025'],
  ['2025-10', 'octubre 2025'],
] as const;

/**
 * StatementDownload (WEB-32, función propia de la web, R53): tarjeta aparte después del historial,
 * con el mes anterior elegido; en teléfono el mes y "Descargar PDF" van a todo lo ancho, en el
 * dashboard en una fila.
 */
function StatementCard() {
  return (
    <ListSection title="Estado de cuenta">
      <div className="grid gap-3">
        <div className="grid gap-3 dashboard:flex dashboard:items-end">
          <div className="dashboard:min-w-56">
            <Select label="Mes" defaultValue="2026-09">
              {STATEMENT_MONTHS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <Button variant="secondary">Descargar PDF</Button>
        </div>
      </div>
    </ListSection>
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
      <StatementCard />
    </>
  );
}

/** /movements — historial de Principal agrupado por día, con "Cargar más" y el estado de cuenta. */
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
    <StatementCard />
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
  /** "Programar" (WEB-33): la fila "Cuándo" del resumen y de la revisión. */
  when?: string;
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

/** La programada canónica (WEB-33): no mueve dinero, así que el límite de hoy no cambia. */
const SCHEDULED_DRAFT: Draft = {
  ...DRAFT,
  amount: '$1,000.00',
  when: 'Se enviará el 20 de octubre de 2026, 14:30',
};

/** Fila etiqueta / valor del resumen (revisión y panel lateral); un valor largo se reparte parejo. */
function SummaryRow({ term, value }: { term: string; value: string | undefined }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 py-3">
      <dt className="text-body-sm text-fg-secondary">{term}</dt>
      <dd className={`text-right text-label text-balance tabular-nums ${value ? 'text-fg' : 'text-fg-muted'}`}>
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
        <SummaryRow
          term="Referencia"
          value={draft.reference === '' ? 'Sin referencia' : draft.reference}
        />
        {draft.when ? <SummaryRow term="Cuándo" value={draft.when} /> : null}
      </dl>
      <p className="border-t border-border pt-3 text-caption text-fg-muted">
        {draft.otp && !draft.final
          ? OTP_NOTICE
          : `Te quedan ${formatMXN(draft.remaining ?? dailyLimit.remaining)} de tu límite diario de hoy.`}
      </p>
    </ListSection>
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

/**
 * Paso 1: cuentas propias y beneficiarios. WEB-36: el campo de búsqueda va arriba de los beneficiarios y
 * solo los filtra (las cuentas propias no); se oculta sin beneficiarios.
 */
function RecipientStep({
  query = '',
  beneficiaries = [luis, mama],
}: {
  query?: string;
  beneficiaries?: (typeof luis)[];
}) {
  return (
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
        <div className="grid gap-2">
          <BeneficiarySearch query={query} />
          {beneficiaries.length > 0 ? (
            <ul className="divide-y divide-border">
              {beneficiaries.map((beneficiary) => (
                <RecipientOption
                  key={beneficiary.id}
                  avatar={<Avatar initials={initials(beneficiary.name)} />}
                  label={beneficiary.alias}
                  description={`${beneficiary.name} · CLABE ${mask(beneficiary.clabe)}`}
                />
              ))}
            </ul>
          ) : (
            <NoResults query={query} flat />
          )}
        </div>
      </ListSection>
      {/* En teléfono "Programadas" no es pestaña: se llega desde aquí (R56); en el dashboard está en
          la navegación lateral. */}
      <a href="#" className={buttonClasses('ghost', 'dashboard:hidden')}>
        Transferencias programadas
      </a>
    </FlowPage>
  );
}

export const TransferRecipient = () => <RecipientStep />;

/** Paso 1 con «mar» escrito: solo "Mamá"; "Ahorro" (cuenta propia) sigue a la vista. */
export const TransferRecipientSearchResults = () => (
  <RecipientStep query="mar" beneficiaries={[mama]} />
);

/** Paso 1 con una búsqueda sin coincidencias. */
export const TransferRecipientNoResults = () => (
  <RecipientStep query="Zapata" beneficiaries={[]} />
);

/** Campos del paso 2: a quién, el monto grande, la cuenta de origen, el concepto y la referencia. */
function AmountFields({ amount, reference = '1' }: { amount: string; reference?: string }) {
  return (
    <>
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
      {/* WEB-21: solo dígitos y un punto mientras se teclea; se muestra con separador de miles
          ("12,345.67") y la API recibe "12345.67". */}
      <AmountField
        variant="hero"
        label="Monto"
        defaultValue={amount}
        hint="Hasta 2 decimales, por ejemplo 1,250.50."
      />
      <Select label="Cuenta de origen" defaultValue={principal.id} hint="Saldo disponible: $25,000.00">
        <option value="">Elige una cuenta</option>
        <option value={principal.id}>Principal · $25,000.00</option>
        <option value={ahorro.id}>Ahorro · $10,000.00</option>
      </Select>
      {/* Ayudas con la redacción de la app móvil (R30); la del monto sigue siendo la de cada app. */}
      <TextField label="Concepto" hint="De 1 a 40 caracteres." autoComplete="off" defaultValue="Renta" />
      {/* WEB-16: opcional, solo dígitos (se descartan al teclear y al pegar), hasta 7. */}
      <TextField
        label="Referencia (opcional)"
        inputMode="numeric"
        maxLength={7}
        hint="Hasta 7 dígitos."
        autoComplete="off"
        defaultValue={reference}
      />
    </>
  );
}

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
    <AmountFields amount="1,250.00" />
  </FlowPage>
);

/**
 * WEB-21 + WEB-16: el monto con separador de miles mientras se teclea (12,345.67; la API recibe 12345.67) y
 * la referencia opcional vacía: el resumen lateral dice "Sin referencia".
 */
export const TransferAmountFormatted = () => (
  <FlowPage
    title="¿Cuánto envías?"
    step={2}
    total={5}
    stepLabel="Monto"
    draft={{ ...DRAFT, amount: '$12,345.67', reference: '' }}
    actions={<Button type="submit">Continuar</Button>}
  >
    <AmountFields amount="12,345.67" reference="" />
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
          {/* WEB-16: sin referencia no hay fila. */}
          {draft.reference === '' ? null : <SummaryRow term="Referencia" value={draft.reference} />}
          {draft.when ? <SummaryRow term="Cuándo" value={draft.when} /> : null}
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

/* ------------------------------------------------- transferencia programada (bonus, WEB-33) */

/**
 * ScheduleField con "Programar" elegido: los radios como los de los filtros (44 px, acento del
 * sistema) y la fecha limitada al rango programable de la Ciudad de México desde NOW (de mañana a 90
 * días).
 */
function ScheduleChoice() {
  return (
    <div className="grid gap-5">
      <fieldset className="grid">
        <legend className="pb-1 text-label text-fg">Cuándo</legend>
        <div className="flex flex-wrap gap-x-6">
          <label className="flex min-h-11 items-center gap-3 text-body text-fg">
            <input type="radio" name="when" value="NOW" className="size-5 accent-action" />
            Ahora
          </label>
          <label className="flex min-h-11 items-center gap-3 text-body text-fg">
            <input
              type="radio"
              name="when"
              value="SCHEDULED"
              defaultChecked
              className="size-5 accent-action"
            />
            Programar
          </label>
        </div>
      </fieldset>
      {/* WEB-33: fecha y hora lado a lado (ScheduleField con `timeField`); la hora es de la Ciudad de México. */}
      <div className="grid content-start items-start gap-4 sm:grid-cols-2 sm:gap-x-3">
        <TextField
          type="date"
          label="Fecha de envío"
          min="2026-10-13"
          max="2027-01-11"
          defaultValue="2026-10-20"
          hint="Entre el 13 de octubre de 2026 y el 11 de enero de 2027."
        />
        <TextField
          type="time"
          label="Hora de envío"
          step={60}
          defaultValue="14:30"
          hint="Hora de la Ciudad de México, al menos 10 minutos después de ahora."
        />
      </div>
    </div>
  );
}

/** Paso 2 con "Programar", el 20 de octubre a las 14:30: el resumen del dashboard ya dice "Cuándo". */
export const TransferAmountScheduled = () => (
  <FlowPage
    title="¿Cuánto envías?"
    step={2}
    total={5}
    stepLabel="Monto"
    draft={SCHEDULED_DRAFT}
    actions={<Button type="submit">Continuar</Button>}
  >
    <AmountFields amount="1,000.00" />
    <ScheduleChoice />
  </FlowPage>
);

/** Paso 3 de 4 de una programada: "Cuándo" es la última fila de la revisión. */
export const TransferReviewScheduled = () => (
  <FlowPage
    {...REVIEW}
    draft={SCHEDULED_DRAFT}
    title="Revisa tu transferencia"
    stackedActions
    actions={
      <>
        <Button>Enviar</Button>
        <Button variant="ghost">Editar</Button>
      </>
    }
  >
    <ReviewSummary draft={SCHEDULED_DRAFT} />
  </FlowPage>
);

/**
 * Paso 4 de 4: la API la programó. El aviso informativo (el tono de "Programada") da la fecha y el
 * enlace a las programadas; el comprobante agrega "Programada para".
 */
export const TransferScheduled = () => (
  <FlowPage
    title="Transferencia programada"
    step={4}
    total={4}
    stepLabel="Comprobante"
    draft={{ ...SCHEDULED_DRAFT, final: true }}
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
    <InlineAlert tone="info">
      Se enviará el 20 de octubre de 2026, 14:30. Puedes cancelarla antes de esa hora en{' '}
      <a href="#" className="text-action underline underline-offset-2">
        tus transferencias programadas
      </a>
      .
    </InlineAlert>
    <Receipt transfer={scheduledTransfer} fromAccount={principal} />
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

/**
 * Campo de búsqueda de beneficiarios (WEB-36: `components/beneficiaries/BeneficiarySearch.tsx`): lupa a la izquierda,
 * placeholder "Buscar por nombre, alias o CLABE", × al haber texto. El filtro es del cliente y no
 * distingue mayúsculas ni acentos (nombre y alias; los dígitos buscan en la CLABE). Se oculta si no
 * hay beneficiarios.
 */
function BeneficiarySearch({ query = '' }: { query?: string }) {
  return (
    <SearchField
      label="Buscar beneficiarios"
      placeholder="Buscar por nombre, alias o CLABE"
      value={query}
      onChange={noop}
      onClear={noop}
    />
  );
}

/**
 * Sin coincidencias (WEB-36): "Sin resultados" con "Limpiar búsqueda". Suelto en la página es el
 * EmptyState del kit; dentro de una tarjeta (`flat`, paso de destinatario) va sin su propia tarjeta
 * para no anidar sombras.
 */
function NoResults({ query, flat = false }: { query: string; flat?: boolean }) {
  const description = `No hay beneficiarios que coincidan con «${query}».`;
  if (!flat) {
    return (
      <EmptyState
        icon="beneficiaries"
        title="Sin resultados"
        description={description}
        action={<Button variant="secondary">Limpiar búsqueda</Button>}
      />
    );
  }
  return (
    <div className="grid justify-items-center gap-3 px-6 py-8 text-center">
      <Avatar size="lg" icon="beneficiaries" />
      <h3 className="text-h3 text-fg">Sin resultados</h3>
      <p className="text-body text-fg-secondary">{description}</p>
      <Button variant="secondary">Limpiar búsqueda</Button>
    </div>
  );
}

/** La lista de beneficiarios de la pantalla (`items` ya filtrados). */
function BeneficiaryList({ items }: { items: (typeof luis)[] }) {
  return (
    <ListSection>
      <ul aria-label="Beneficiarios" className="divide-y divide-border">
        {items.map((beneficiary) => (
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
  );
}

/** /beneficiaries — la lista (ordenada por alias) con el campo de búsqueda; en teléfono, "Agregar" va arriba. */
export const Beneficiaries = () => (
  <BeneficiariesShell>
    <a href="#" className={buttonClasses('primary', 'dashboard:hidden')}>
      Agregar beneficiario
    </a>
    <BeneficiarySearch />
    <BeneficiaryList items={[luis, mama]} />
  </BeneficiariesShell>
);

/** /beneficiaries con «mar» escrito: solo "Mamá" (María Gómez); «maria» también la encontraría. */
export const BeneficiariesSearchResults = () => (
  <BeneficiariesShell>
    <a href="#" className={buttonClasses('primary', 'dashboard:hidden')}>
      Agregar beneficiario
    </a>
    <BeneficiarySearch query="mar" />
    <BeneficiaryList items={[mama]} />
  </BeneficiariesShell>
);

/** /beneficiaries con una búsqueda sin coincidencias. */
export const BeneficiariesNoResults = () => (
  <BeneficiariesShell>
    <a href="#" className={buttonClasses('primary', 'dashboard:hidden')}>
      Agregar beneficiario
    </a>
    <BeneficiarySearch query="Zapata" />
    <NoResults query="Zapata" />
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

/* ------------------------------------------------------- programadas (bonus, WEB-34) */

/**
 * /transfers/scheduled — "Programadas": en el dashboard es un destino de la navegación lateral con
 * su icono (CalendarClock) y "Nueva transferencia" va en la barra superior; en teléfono no es
 * pestaña (R56) y la acción va arriba de la lista, como en Beneficiarios.
 */
function ScheduledShell({ children }: { children: ReactNode }) {
  return (
    <AppShell
      current="scheduled"
      title="Transferencias programadas"
      user={user}
      primaryAction={newTransfer}
      onLogout={noop}
    >
      {children}
    </AppShell>
  );
}

/** La lista de la API: fecha, monto, destino con su CLABE enmascarada y concepto, con "Cancelar". */
function ScheduledList() {
  return (
    <>
      <a href="#" className={buttonClasses('primary', 'dashboard:hidden')}>
        Nueva transferencia
      </a>
      <ListSection>
        <ul aria-label="Transferencias programadas" className="divide-y divide-border">
          <li className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="grid min-w-0 gap-1">
              <p className="text-label text-fg">
                <time dateTime={scheduledTransfer.scheduledFor}>20 de octubre de 2026, 14:30</time>
              </p>
              <p className="text-h3 text-fg tabular-nums">{formatMXN(scheduledTransfer.amount)}</p>
              <p className="text-body-sm text-fg-secondary">
                {luis.alias} {mask(luis.clabe)}
              </p>
              <p className="text-caption text-fg-muted">{scheduledTransfer.concept}</p>
            </div>
            <Button
              variant="secondary"
              aria-label="Cancelar la transferencia de $1,000.00 a Luis del 20 de octubre de 2026, 14:30"
            >
              Cancelar
            </Button>
          </li>
        </ul>
      </ListSection>
    </>
  );
}

const scheduledEmpty = (
  <EmptyState
    icon="scheduled"
    title="No tienes transferencias programadas"
    description='Al hacer una transferencia, elige "Programar" en "Cuándo" para enviarla en otra fecha.'
    action={
      <a href="#" className={buttonClasses('secondary')}>
        Programar una transferencia
      </a>
    }
  />
);

/** La programada canónica, lista para cancelarse. */
export const ScheduledTransfers = () => (
  <ScheduledShell>
    <ScheduledList />
  </ScheduledShell>
);

/** Sin programadas: el estado vacío con el icono de "Programadas". */
export const ScheduledTransfersEmpty = () => <ScheduledShell>{scheduledEmpty}</ScheduledShell>;

/**
 * "Cancelar" abierto: el diálogo con la forma de la hoja del kit (asa en teléfono, centrado en el
 * dashboard) con el monto, el destino y la fecha.
 */
export const ScheduledTransfersCancel = () => (
  <ScheduledShell>
    <ScheduledList />
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-surface-hero/60 dashboard:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-scheduled-title"
        aria-describedby="cancel-scheduled-description"
        className="flex max-h-[85dvh] w-full max-w-app flex-col gap-4 rounded-t-lg bg-surface px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-sheet dashboard:max-w-md dashboard:rounded-lg dashboard:pb-6"
      >
        <div
          aria-hidden="true"
          className="mx-auto h-1 w-10 shrink-0 rounded-pill bg-border dashboard:hidden"
        />
        <h2
          id="cancel-scheduled-title"
          className="flex min-h-11 shrink-0 items-center text-h3 text-fg"
        >
          ¿Cancelar la transferencia programada?
        </h2>
        <div className="grid min-h-0 gap-5 overflow-y-auto">
          <p id="cancel-scheduled-description" className="text-body text-fg-secondary">
            Transferencia de $1,000.00 a Luis •••• 5678, programada para el 20 de octubre de 2026, 14:30.
            Si la cancelas, no se enviará.
          </p>
          <div className="grid gap-3 dashboard:flex dashboard:flex-wrap">
            <Button variant="destructive">Cancelar transferencia</Button>
            <Button variant="secondary">Volver</Button>
          </div>
        </div>
      </div>
    </div>
  </ScheduledShell>
);

/**
 * La programada ya se ejecutó (409 TRANSFER_NOT_CANCELLABLE): el mensaje del paquete de diseño y la
 * lista, vuelta a cargar, ya no la incluye.
 */
export const ScheduledTransfersCancelError = () => (
  <ScheduledShell>
    <InlineAlert tone="danger">Esta transferencia ya no se puede cancelar.</InlineAlert>
    {scheduledEmpty}
  </ScheduledShell>
);
