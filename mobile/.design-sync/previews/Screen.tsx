/*
 * Mapa de pantallas rediseñadas de la app móvil (MOB-18 a MOB-22): una historia por pantalla y por
 * estado, en un marco de 390x844, con los mismos nombres que las historias de `AppShell` en la web
 * para el lienzo de paridad. Cada historia renderiza la vista real de la pantalla (los `*-view.tsx`
 * puros de `src/features/**` y `src/navigation/startup-views.tsx`, tarea 8.1) con los datos
 * canónicos: lo que se ve aquí es el código de presentación de la app, con el mismo tema y
 * react-native-web. Los contenedores (expo-router, TanStack Query, sesión) no entran en el lienzo;
 * la barra de pestañas es el `TabBar` del kit que monta el layout de pestañas.
 * Los datos son el bloque canónico del plan, idéntico en la web.
 *
 * Funciones propias de la app (bonus, sin pareja web): la pantalla de bloqueo y la oferta del
 * desbloqueo biométrico (MOB-24, MOB-25, MOB-26) y el comprobante de una transferencia programada o
 * cancelada (MOB-23). El menú de la cuenta con el interruptor del desbloqueo es una hoja (`Modal`):
 * está en las historias de `BottomSheet` (`AccountMenuUnlock`), como el menú de la cuenta.
 */
import type { ReactNode } from 'react';
import {
  HomeView,
  LockScreenView,
  LoginView,
  MovementsView,
  ProblemError,
  RecipientView,
  StartupLoading as StartupLoadingView,
  StartupOffline as StartupOfflineView,
  StyleSheet,
  TabBar,
  TransferFlowView,
  UnlockOfferView,
  View,
} from 'wallet-mobile-ui';

const noop = () => {};

// --- Datos canónicos (plan, "Canonical story data"): los mismos valores en la web ---------------

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

// --- Derivados -----------------------------------------------------------------------------------

const TABS = ['home', 'movements', 'transfer'] as const;
type Tab = (typeof TABS)[number];

// La transferencia de $1,250.00 tal como la devuelve la API (su movimiento es mv-1).
const completedTransfer = {
  id: '7f1c2a8e-5a0b-4c4e-9a59-8f0e1c2d3b4a',
  status: 'COMPLETED' as const,
  kind: 'THIRD_PARTY' as const,
  fromAccountId: principal.id,
  destination: {
    type: 'BENEFICIARY' as const,
    accountId: null,
    beneficiaryId: luis.id,
    displayName: luis.alias,
    clabeLast4: '5678',
  },
  amount: '1250.00',
  concept: 'Renta',
  reference: '1',
  requiresOtp: false,
  otp: null,
  rejectionReason: null,
  failureReason: null,
  createdAt: '2026-10-13T16:41:00Z',
  completedAt: '2026-10-13T16:42:00Z',
};

// La de $15,000.00 tal como quedó al pedir el código (PENDING_OTP). Al agotar los intentos la API
// responde 422 OTP_ATTEMPTS_EXHAUSTED y la vista la muestra "Fallida" con ese veredicto.
const failedTransfer = {
  ...completedTransfer,
  id: '4c8e2f6a-1b3d-4e5f-9a7b-6c8d0e2f4a6b',
  status: 'PENDING_OTP' as const,
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
  createdAt: '2026-10-13T17:41:00Z',
  completedAt: null,
};

// Programada (bonus de la web, WEB-33): $1,000.00 a Luis para el 20 de octubre de 2026. La app no
// programa ni cancela (MOB-23), pero si la API devuelve una en esos estados la muestra con su etiqueta.
const scheduledTransfer = {
  ...completedTransfer,
  id: '9a3b5c7d-2e4f-4a6b-8c0d-1e3f5a7b9c2d',
  status: 'SCHEDULED' as const,
  amount: '1000.00',
  scheduledFor: '2026-10-20',
  cancelledAt: null,
  createdAt: '2026-10-13T16:50:00Z',
  completedAt: null,
};

// --- Textos: errorMessage() de src/lib/errors.ts con problemMessages del paquete de diseño ------

const NETWORK_ERROR_MESSAGE =
  'No pudimos conectar con TreoWallet. Revisa tu conexión e intenta de nuevo.';
const RATE_LIMITED = 'Hiciste demasiados intentos. Espera un momento y vuelve a intentar.';

// --- Estilos (solo `theme`) ------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Marco de teléfono: el mismo de `initialMetrics` del proveedor.
  phone: { width: 390, height: 844 },
  fill: { flex: 1 },
});

// --- Marcos y datos de las vistas --------------------------------------------------------------------

/** Pestaña con sesión (MOB-18): la vista y, abajo, la barra de pestañas del layout. */
function TabFrame({ current, children }: { current: Tab; children: ReactNode }) {
  return (
    <View style={styles.phone}>
      <View style={styles.fill}>
        {children}
        <TabBar items={TABS} current={current} onSelect={noop} />
      </View>
    </View>
  );
}

const OVERVIEW = { status: 'success', data: { accounts: [principal, ahorro], dailyLimit } } as const;
const LATEST = { status: 'success', data: movements } as const;
const PENDING = { status: 'pending' } as const;

// Lecturas del flujo listas: las dos cuentas y el beneficiario elegido en el paso 1.
const READY = { status: 'success', data: { accounts: [principal, ahorro], beneficiary: luis } } as const;
const ACTIONS = {
  onClose: noop,
  onReload: noop,
  onChange: noop,
  onContinue: noop,
  onSubmit: noop,
  onEdit: noop,
  onRetry: noop,
  onCodeChange: noop,
  onConfirm: noop,
  onResend: noop,
  onRestart: noop,
  onHome: noop,
  onAnother: noop,
};
const VALUES = { fromAccountId: principal.id, amount: '1250.00', concept: 'Renta', reference: '1' };
// Datos congelados del intento al pasar a revisión.
const FROZEN = {
  key: 'k',
  payload: '{}',
  draft: { fromAccountId: principal.id, beneficiaryId: luis.id, amount: '1250.00', concept: 'Renta', reference: '1' },
};

function Flow({ state, code = '' }: { state: Parameters<typeof TransferFlowView>[0]['state']; code?: string }) {
  return (
    <View style={styles.phone}>
      <TransferFlowView state={state} data={READY} values={VALUES} errors={{}} code={code} actions={ACTIONS} />
    </View>
  );
}

// --- Arranque: navigation/startup-views.tsx (sin Screen, como en la app) ------------------------

export const StartupLoading = () => (
  <View style={styles.phone}>
    <StartupLoadingView />
  </View>
);

export const StartupOffline = () => (
  <View style={styles.phone}>
    <StartupOfflineView onRetry={noop} />
  </View>
);

// --- Inicio de sesión (MOB-22): features/auth/login-view.tsx sobre la superficie de marca ---------

export const Login = () => (
  <View style={styles.phone}>
    <LoginView
      email=""
      password=""
      fieldErrors={{}}
      alert={null}
      lockRemaining={0}
      submitting={false}
      onChangeEmail={noop}
      onChangePassword={noop}
      onSubmit={noop}
    />
  </View>
);

// 429 con Retry-After: aviso, cuenta regresiva y botón deshabilitado (la contraseña se conserva).
export const LoginRateLimited = () => (
  <View style={styles.phone}>
    <LoginView
      email={user.email}
      password="contraseña-segura"
      fieldErrors={{}}
      alert={{ tone: 'warning', message: RATE_LIMITED }}
      lockRemaining={42}
      submitting={false}
      onChangeEmail={noop}
      onChangePassword={noop}
      onSubmit={noop}
    />
  </View>
);

// --- Inicio (MOB-19): features/accounts/home-view.tsx ----------------------------------------------

const homeProps = {
  user,
  onLogout: noop,
  selectedId: principal.id,
  latest: LATEST,
  now: NOW,
  onSelect: noop,
  onRetryOverview: noop,
  onRetryLatest: noop,
  onTransfer: noop,
  onSeeAll: noop,
};

export const Home = () => (
  <TabFrame current="home">
    <HomeView {...homeProps} overview={OVERVIEW} />
  </TabFrame>
);

// Sin cuentas: el total es cero y no se ha usado nada del límite.
export const HomeEmpty = () => (
  <TabFrame current="home">
    <HomeView
      {...homeProps}
      overview={{
        status: 'success',
        data: { accounts: [], dailyLimit: { ...dailyLimit, used: '0.00', remaining: dailyLimit.limit } },
      }}
      selectedId={undefined}
      latest={PENDING}
    />
  </TabFrame>
);

// Cargando: el encabezado ya saluda a Ana (la sesión trae a la persona).
export const HomeLoading = () => (
  <TabFrame current="home">
    <HomeView {...homeProps} overview={PENDING} latest={PENDING} />
  </TabFrame>
);

// La consulta falló (sin red): no se muestran saldos anteriores, solo el error y Reintentar.
export const HomeError = () => (
  <TabFrame current="home">
    <HomeView
      {...homeProps}
      overview={{ status: 'error', message: NETWORK_ERROR_MESSAGE }}
      latest={PENDING}
    />
  </TabFrame>
);

// --- Movimientos (MOB-20): features/accounts/movements-view.tsx ------------------------------------

const movementsProps = {
  user,
  onLogout: noop,
  overview: OVERVIEW,
  selectedId: principal.id,
  now: NOW,
  onSelect: noop,
  onRetryAccounts: noop,
  onRetryMovements: noop,
};

export const Movements = () => (
  <TabFrame current="movements">
    <MovementsView {...movementsProps} movements={LATEST} />
  </TabFrame>
);

export const MovementsEmpty = () => (
  <TabFrame current="movements">
    <MovementsView {...movementsProps} movements={{ status: 'success', data: [] }} />
  </TabFrame>
);

// --- Transferir (MOB-21): Destinatario → Monto → Revisión → Código (si aplica) → Comprobante -----

// features/transfer/recipient-view.tsx
export const TransferRecipient = () => (
  <View style={styles.phone}>
    <RecipientView
      beneficiaries={{ status: 'success', data: { items: [luis, mama] } }}
      onPick={noop}
      onRetry={noop}
      onClose={noop}
    />
  </View>
);

// La app no da de alta beneficiarios: sin ninguno, indica registrarlos en la web.
export const TransferRecipientEmpty = () => (
  <View style={styles.phone}>
    <RecipientView
      beneficiaries={{ status: 'success', data: { items: [] } }}
      onPick={noop}
      onRetry={noop}
      onClose={noop}
    />
  </View>
);

// features/transfer/transfer-flow-view.tsx, un estado del intento por historia.
export const TransferAmount = () => <Flow state={{ status: 'editing' }} />;

// Sin código: el flujo tiene 4 pasos.
export const TransferReview = () => <Flow state={{ status: 'reviewing', ...FROZEN }} />;

// Se perdió la red: la misma operación, con Enviar ocupado (MOB-10).
export const TransferRetrying = () => (
  <Flow state={{ status: 'waitingRetry', retry: 1, delayMs: 1000, ...FROZEN }} />
);

// Reintentos agotados: ni éxito ni falla, solo Reintentar con la misma llave.
export const TransferUncertain = () => <Flow state={{ status: 'uncertain', ...FROZEN }} />;

// 422 INSUFFICIENT_FUNDS al crearla: $30,000.00 supera los $25,000.00 de Principal. Es mayor a
// $10,000.00, así que la revisión avisa del código y el flujo tiene 5 pasos.
export const TransferRejected = () => (
  <Flow
    state={{
      status: 'rejected',
      ...FROZEN,
      draft: { ...FROZEN.draft, amount: '30000.00' },
      error: new ProblemError(422, { code: 'INSUFFICIENT_FUNDS', title: 'Saldo insuficiente', status: 422 }),
    }}
  />
);

// Código para $15,000.00 (3 intentos), ya escrito y con Confirmar habilitado, como en la web. El
// vencimiento es relativo al render: la cuenta regresiva arranca en 4:32.
export const TransferOtp = () => (
  <Flow
    state={{
      status: 'pendingOtp',
      transfer: {
        ...failedTransfer,
        otp: {
          ...failedTransfer.otp,
          attemptsRemaining: 3,
          expiresAt: new Date(Date.now() + 272_000).toISOString(),
        },
      },
    }}
    code="482913"
  />
);

// El comprobante con lo que devolvió la API (MOB-13).
export const TransferCompleted = () => (
  <Flow state={{ status: 'completed', transfer: completedTransfer, replayed: false }} />
);

// 422 OTP_ATTEMPTS_EXHAUSTED al confirmar el código.
export const TransferFailed = () => (
  <Flow
    state={{
      status: 'failed',
      transfer: failedTransfer,
      error: new ProblemError(422, { code: 'OTP_ATTEMPTS_EXHAUSTED', title: 'Intentos agotados', status: 422 }),
    }}
  />
);

// --- Estados de las programadas (bonus, MOB-23): sin pareja en la web --------------------------

// La API respondió con una transferencia en SCHEDULED: "Programada" en el tono informativo, sin error,
// y el título del paso dice que se programó.
export const TransferOutcomeScheduled = () => (
  <Flow state={{ status: 'completed', transfer: scheduledTransfer, replayed: false }} />
);

// Una repetición de la misma operación devuelve la transferencia en su estado actual: cancelada en la
// web. "Cancelada" en el tono neutro.
export const TransferOutcomeCancelled = () => (
  <Flow
    state={{
      status: 'completed',
      transfer: { ...scheduledTransfer, status: 'CANCELLED', cancelledAt: '2026-10-14T15:00:00Z' },
      replayed: true,
    }}
  />
);

// --- Desbloqueo biométrico (bonus, MOB-24 a MOB-26): sin pareja en la web ------------------------

// features/unlock/lock-screen-view.tsx: la marca y las dos opciones, sin saldos ni datos personales.
// Ya se canceló el diálogo biométrico: "Desbloquear con huella" lo vuelve a abrir.
export const LockScreen = () => (
  <View style={styles.phone}>
    <LockScreenView kind="huella" prompting={false} notice={null} onUnlock={noop} onSignOut={noop} />
  </View>
);

// El sistema bloqueó la biometría por demasiados intentos (MOB-26): el aviso y las dos opciones.
export const LockScreenLockout = () => (
  <View style={styles.phone}>
    <LockScreenView
      kind="huella"
      prompting={false}
      notice={{
        tone: 'warning',
        message: 'Demasiados intentos. Intenta más tarde o usa tu contraseña.',
      }}
      onUnlock={noop}
      onSignOut={noop}
    />
  </View>
);

// Inicio después de entrar con contraseña (MOB-24): la oferta va como tarjeta bajo el hero.
export const HomeUnlockOffer = () => (
  <TabFrame current="home">
    <HomeView
      {...homeProps}
      overview={OVERVIEW}
      offer={<UnlockOfferView kind="huella" activating={false} onActivate={noop} onDecline={noop} />}
    />
  </TabFrame>
);
