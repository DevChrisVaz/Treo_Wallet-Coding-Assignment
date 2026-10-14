/*
 * Mapa de pantallas rediseñadas de la app móvil (MOB-18 a MOB-22): una historia por pantalla y por
 * estado, en un marco de 390x844, con los mismos nombres que las historias de `AppShell` en la web
 * para el lienzo de paridad. Las pantallas reales no se pueden importar (expo-router, TanStack
 * Query, sesión): cada historia compone el kit con la estructura del rediseño (pestañas, flujo por
 * pasos, superficie de marca) y los textos de `src/features/**` y `src/navigation/root-navigator.tsx`.
 * Los datos son el bloque canónico del plan, idéntico en la web.
 */
import type { ReactNode } from 'react';
import {
  AccountCard,
  ActivityIndicator,
  AmountField,
  AppHeader,
  Avatar,
  BalanceHero,
  BrandScreen,
  Button,
  DailyLimitMeter,
  EmptyState,
  FlowHeader,
  Icon,
  InlineAlert,
  ListSection,
  MovementList,
  OtpField,
  Pressable,
  QuickActions,
  Receipt,
  Screen,
  Select,
  Skeleton,
  StyleSheet,
  TabBar,
  Text,
  TextField,
  View,
  Wordmark,
  initials,
  theme,
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

// sumAmounts([principal.balance, ahorro.balance]) de src/lib/display.ts (no está en el bundle).
const TOTAL = '35000.00';
const TABS = ['home', 'movements', 'transfer'] as const;
type Tab = (typeof TABS)[number];

// maskClabe() de src/lib/display.ts.
const mask = (clabe: string) => `•••• ${clabe.slice(-4)}`;

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

// La de $15,000.00 pidió código y se canceló al agotar los intentos (422 OTP_ATTEMPTS_EXHAUSTED).
const failedTransfer = {
  ...completedTransfer,
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

// --- Textos: errorMessage() de src/lib/errors.ts con problemMessages del paquete de diseño ------

const NETWORK_ERROR_MESSAGE =
  'No pudimos conectar con TreoWallet. Revisa tu conexión e intenta de nuevo.';
const RATE_LIMITED = 'Hiciste demasiados intentos. Espera un momento y vuelve a intentar.';
const UNCERTAIN_TITLE = 'No pudimos confirmar el estado de tu transferencia';
const INSUFFICIENT_FUNDS = 'No tienes saldo suficiente para esta transferencia.';
const OTP_ATTEMPTS_EXHAUSTED = 'Agotaste los intentos. Cancelamos la transferencia.';

// --- Estilos (solo `theme`) ------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Marco de teléfono: el mismo de `initialMetrics` del proveedor.
  phone: { width: 390, height: 844 },
  fill: { flex: 1 },
  // root-navigator.tsx
  startup: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[4],
    padding: theme.spacing[6],
    backgroundColor: theme.colors.surface.default,
  },
  startupTitle: { ...theme.typography.h3, color: theme.colors.text.primary, textAlign: 'center' },
  startupBody: {
    ...theme.typography.body,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  // login-screen.tsx
  form: { gap: theme.spacing[4] },
  countdown: { ...theme.typography.bodySm, ...theme.amount, color: theme.colors.text.secondary },
  note: { ...theme.typography.caption, color: theme.colors.text.muted, textAlign: 'center' },
  // Inicio y Movimientos
  stack: { gap: theme.spacing[3] },
  list: { gap: theme.spacing[4] },
  link: { minHeight: theme.touchTarget, justifyContent: 'center' },
  linkText: { ...theme.typography.label, color: theme.colors.action.primary },
  segmented: { flexDirection: 'row', gap: theme.spacing[2] },
  segment: { flex: 1 },
  // Filas de lista (destinatario y resumen)
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    minHeight: theme.touchTarget,
    paddingVertical: theme.spacing[3],
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border.default,
  },
  rowText: { flex: 1, minWidth: 0, gap: theme.spacing[1] },
  rowTitle: { ...theme.typography.label, color: theme.colors.text.primary },
  rowDetail: { ...theme.typography.caption, color: theme.colors.text.secondary },
  summaryLabel: { ...theme.typography.bodySm, color: theme.colors.text.secondary },
  summaryValue: {
    ...theme.typography.label,
    flexShrink: 1,
    color: theme.colors.text.primary,
    textAlign: 'right',
  },
  // Monto protagonista de la revisión y del código
  amountBlock: { alignItems: 'center', gap: theme.spacing[1], paddingVertical: theme.spacing[2] },
  amountLabel: { ...theme.typography.label, color: theme.colors.text.secondary },
  amount: { ...theme.typography.display, ...theme.amount, color: theme.colors.text.primary },
  amountCaption: { ...theme.typography.bodySm, color: theme.colors.text.secondary },
  // otp-view.tsx
  body: { ...theme.typography.body, color: theme.colors.text.primary },
  meta: { ...theme.typography.bodySm, ...theme.amount, color: theme.colors.text.secondary },
  tight: { gap: theme.spacing[1] },
});

// --- Estructuras de pantalla -----------------------------------------------------------------------

/** Pestaña con sesión (MOB-18): encabezado con el avatar, contenido y barra de pestañas. */
function TabScreen({
  current,
  title,
  children,
}: {
  current: Tab;
  title?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.phone}>
      <View style={styles.fill}>
        <Screen tabBar header={<AppHeader user={user} title={title} onLogout={noop} />}>
          {children}
        </Screen>
        <TabBar items={TABS} current={current} onSelect={noop} />
      </View>
    </View>
  );
}

/** Paso del flujo de transferencia (MOB-21): a pantalla completa, sin pestañas; acciones abajo. */
function FlowScreen({
  title,
  step,
  total,
  stepLabel,
  footer,
  children,
}: {
  title: string;
  step: number;
  total: number;
  stepLabel: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={styles.phone}>
      <Screen
        header={
          <FlowHeader
            title={title}
            step={step}
            total={total}
            stepLabel={stepLabel}
            onClose={noop}
          />
        }
        footer={footer}
      >
        {children}
      </Screen>
    </View>
  );
}

// --- Piezas compartidas ----------------------------------------------------------------------------

const quickActions = (
  <QuickActions
    actions={[
      { key: 'transfer', label: 'Transferir', icon: 'transfer', onPress: noop },
      { key: 'movements', label: 'Movimientos', icon: 'movements', onPress: noop },
    ]}
  />
);

function SeeAll() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ver todos los movimientos"
      onPress={noop}
      style={styles.link}
    >
      <Text style={styles.linkText}>Ver todos</Text>
    </Pressable>
  );
}

/** Selector de cuenta de Movimientos (control segmentado con las dos cuentas, D9). */
function AccountSwitch() {
  return (
    <View style={styles.segmented}>
      <View style={styles.segment}>
        <Button label={principal.name} onPress={noop} />
      </View>
      <View style={styles.segment}>
        <Button label={ahorro.name} variant="secondary" onPress={noop} />
      </View>
    </View>
  );
}

/** Beneficiario elegible (beneficiary-picker-screen.tsx): toda la fila es el botón. */
function RecipientRow({
  beneficiary,
  first,
}: {
  beneficiary: typeof luis;
  first: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${beneficiary.alias}, ${beneficiary.name}, CLABE terminación ${beneficiary.clabe.slice(-4)}`}
      onPress={noop}
      style={[styles.row, first ? null : styles.divider]}
    >
      <Avatar initials={initials(beneficiary.name)} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{beneficiary.alias}</Text>
        <Text style={styles.rowDetail} numberOfLines={1}>
          {`${beneficiary.name} · CLABE ${mask(beneficiary.clabe)}`}
        </Text>
      </View>
      <Icon name="forward" color={theme.colors.text.muted} />
    </Pressable>
  );
}

function SummaryRow({ label, value, first = false }: { label: string; value: string; first?: boolean }) {
  return (
    <View style={[styles.row, first ? null : styles.divider]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <View style={styles.fill} />
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function AmountBlock({ amount, caption }: { amount: string; caption?: string }) {
  return (
    <View style={styles.amountBlock}>
      <Text style={styles.amountLabel}>Monto</Text>
      <Text style={styles.amount}>{amount}</Text>
      {caption ? <Text style={styles.amountCaption}>{caption}</Text> : null}
    </View>
  );
}

/**
 * review-view.tsx: el monto y el resumen con los datos congelados del intento; arriba de
 * $10,000.00 avisa que pedirá un código (y el flujo tiene 5 pasos).
 */
function ReviewSummary({ amount = '$1,250.00', requiresOtp = false }: { amount?: string; requiresOtp?: boolean }) {
  return (
    <>
      <AmountBlock amount={amount} />
      <ListSection>
        <SummaryRow first label="Desde" value={`${principal.name} · ${mask(principal.clabe)}`} />
        <SummaryRow label="Para" value={`${luis.alias} · ${mask(luis.clabe)}`} />
        <SummaryRow label="Concepto" value="Renta" />
        <SummaryRow label="Referencia" value="1" />
      </ListSection>
      {requiresOtp ? (
        <InlineAlert
          tone="info"
          message="Como el monto es mayor a $10,000.00, te enviaremos un código de confirmación a tu correo."
        />
      ) : null}
    </>
  );
}

const reviewProps = { title: 'Revisa tu transferencia', step: 3, total: 4, stepLabel: 'Revisión' };

// --- Arranque: navigation/root-navigator.tsx (sin Screen, como en la app) -----------------------

export const StartupLoading = () => (
  <View style={styles.phone}>
    <View style={styles.startup} accessibilityLabel="Cargando">
      <Wordmark />
      <ActivityIndicator color={theme.colors.action.primary} />
    </View>
  </View>
);

export const StartupOffline = () => (
  <View style={styles.phone}>
    <View style={styles.startup}>
      <Wordmark />
      <Text style={styles.startupTitle} accessibilityRole="header">
        No pudimos conectar con TreoWallet
      </Text>
      <Text style={styles.startupBody}>Revisa tu conexión e intenta de nuevo.</Text>
      <Button label="Reintentar" onPress={noop} />
    </View>
  </View>
);

// --- Inicio de sesión (MOB-22): features/auth/login-screen.tsx sobre la superficie de marca -------

const loginNote = (
  <Text style={styles.note}>
    ¿Aún no tienes cuenta? El registro y la verificación del correo se hacen en la web de
    TreoWallet.
  </Text>
);

export const Login = () => (
  <View style={styles.phone}>
    <BrandScreen title="Inicia sesión">
      <View style={styles.form}>
        <TextField
          label="Correo"
          variant="email"
          value=""
          onChangeText={noop}
          returnKeyType="next"
        />
        <TextField
          label="Contraseña"
          variant="password"
          value=""
          onChangeText={noop}
          returnKeyType="go"
        />
        <Button label="Iniciar sesión" onPress={noop} />
      </View>
      {loginNote}
    </BrandScreen>
  </View>
);

// 429 con Retry-After: aviso, cuenta regresiva y botón deshabilitado (la contraseña se conserva).
export const LoginRateLimited = () => (
  <View style={styles.phone}>
    <BrandScreen title="Inicia sesión">
      <InlineAlert tone="warning" message={RATE_LIMITED} />
      <View style={styles.form}>
        <TextField
          label="Correo"
          variant="email"
          value={user.email}
          onChangeText={noop}
          returnKeyType="next"
        />
        <TextField
          label="Contraseña"
          variant="password"
          value="contraseña-segura"
          onChangeText={noop}
          returnKeyType="go"
        />
        <Text style={styles.countdown}>Podrás intentar de nuevo en 42 s.</Text>
        <Button label="Iniciar sesión" onPress={noop} disabled />
      </View>
      {loginNote}
    </BrandScreen>
  </View>
);

// --- Inicio (MOB-19): hero del saldo, cuentas seleccionables, límite y últimos movimientos -------

export const Home = () => (
  <TabScreen current="home">
    <BalanceHero total={TOTAL} available={dailyLimit.remaining} actions={quickActions} />
    <View style={styles.stack}>
      <AccountCard
        name={principal.name}
        clabe={principal.clabe}
        balance={principal.balance}
        selected
        onPress={noop}
      />
      <AccountCard
        name={ahorro.name}
        clabe={ahorro.clabe}
        balance={ahorro.balance}
        onPress={noop}
      />
    </View>
    <ListSection>
      <DailyLimitMeter dailyLimit={dailyLimit} />
    </ListSection>
    <ListSection title="Últimos movimientos" action={<SeeAll />}>
      <MovementList movements={movements} now={NOW} />
    </ListSection>
  </TabScreen>
);

// Sin cuentas: el total es cero y no se ha usado nada del límite.
export const HomeEmpty = () => (
  <TabScreen current="home">
    <BalanceHero total="0.00" available={dailyLimit.limit} />
    <EmptyState
      icon="account"
      title="Aún no tienes cuentas"
      description="Cuando tu cuenta esté lista, aquí verás su saldo."
      action={{ label: 'Volver a cargar', onPress: noop }}
    />
  </TabScreen>
);

export const HomeLoading = () => (
  <TabScreen current="home">
    <Skeleton variant="card" />
    <View style={styles.stack}>
      <Skeleton variant="card" />
      <Skeleton variant="card" />
    </View>
    <ListSection>
      <View style={styles.stack}>
        <Skeleton />
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </View>
    </ListSection>
  </TabScreen>
);

// La consulta falló (sin red): no se muestran saldos anteriores, solo el error y Reintentar.
export const HomeError = () => (
  <TabScreen current="home">
    <View style={styles.list}>
      <InlineAlert tone="danger" message={NETWORK_ERROR_MESSAGE} />
      <Button label="Reintentar" variant="secondary" onPress={noop} />
    </View>
  </TabScreen>
);

// --- Movimientos (MOB-20): selector de cuenta y últimos 20 movimientos agrupados por día ---------

export const Movements = () => (
  <TabScreen current="movements" title="Movimientos">
    <AccountSwitch />
    <ListSection>
      <MovementList movements={movements} now={NOW} />
    </ListSection>
  </TabScreen>
);

export const MovementsEmpty = () => (
  <TabScreen current="movements" title="Movimientos">
    <AccountSwitch />
    <EmptyState
      icon="movements"
      title="Aún no hay movimientos"
      description="Aquí verás los depósitos y las transferencias de esta cuenta."
    />
  </TabScreen>
);

// --- Transferir (MOB-21): Destinatario → Monto → Revisión → Código (si aplica) → Comprobante -----

export const TransferRecipient = () => (
  <FlowScreen title="¿A quién le envías?" step={1} total={5} stepLabel="Destinatario">
    <ListSection title="Beneficiarios">
      {[luis, mama].map((beneficiary, index) => (
        <RecipientRow key={beneficiary.id} beneficiary={beneficiary} first={index === 0} />
      ))}
    </ListSection>
  </FlowScreen>
);

// La app no da de alta beneficiarios: sin ninguno, indica registrarlos en la web.
export const TransferRecipientEmpty = () => (
  <FlowScreen title="¿A quién le envías?" step={1} total={5} stepLabel="Destinatario">
    <EmptyState
      icon="beneficiaries"
      title="Aún no tienes beneficiarios"
      description="Regístralos en la web de TreoWallet para poder enviarles dinero desde aquí."
    />
  </FlowScreen>
);

// form-view.tsx con el monto como protagonista; AmountField quita las comas al escribir.
export const TransferAmount = () => (
  <FlowScreen
    title="¿Cuánto envías?"
    step={2}
    total={5}
    stepLabel="Monto"
    footer={<Button label="Continuar" onPress={noop} />}
  >
    <ListSection>
      <View style={styles.row}>
        <Avatar initials={initials(luis.name)} />
        <View style={styles.rowText}>
          <Text style={styles.rowDetail}>Para</Text>
          <Text style={styles.rowTitle}>{`${luis.alias} · CLABE ${mask(luis.clabe)}`}</Text>
        </View>
      </View>
    </ListSection>
    <AmountField
      variant="hero"
      label="Monto"
      value="1250.00"
      onChangeText={noop}
      help="Hasta 2 decimales, sin comas."
    />
    <Select
      label="Cuenta de origen"
      placeholder="Elige una cuenta"
      options={[
        {
          value: principal.id,
          label: principal.name,
          description: `CLABE ${mask(principal.clabe)} · $25,000.00`,
        },
        {
          value: ahorro.id,
          label: ahorro.name,
          description: `CLABE ${mask(ahorro.clabe)} · $10,000.00`,
        },
      ]}
      value={principal.id}
      onChange={noop}
    />
    <TextField label="Concepto" value="Renta" onChangeText={noop} help="De 1 a 40 caracteres." />
    <TextField
      label="Referencia"
      value="1"
      onChangeText={noop}
      help="De 1 a 7 dígitos."
      keyboardType="number-pad"
      inputMode="numeric"
    />
  </FlowScreen>
);

// reviewing -> attempt-actions.tsx (Enviar / Editar). Sin código: el flujo tiene 4 pasos.
export const TransferReview = () => (
  <FlowScreen
    {...reviewProps}
    footer={
      <>
        <Button label="Enviar" onPress={noop} />
        <Button label="Editar" variant="ghost" onPress={noop} />
      </>
    }
  >
    <ReviewSummary />
  </FlowScreen>
);

// waitingRetry -> se perdió la red: la misma operación, con Enviar ocupado (MOB-10).
export const TransferRetrying = () => (
  <FlowScreen
    {...reviewProps}
    title="Enviando tu transferencia"
    footer={<Button label="Enviar" onPress={noop} loading />}
  >
    <ReviewSummary />
    <InlineAlert
      tone="warning"
      message="Perdimos la conexión. Reintentaremos la misma operación (1 de 5)."
    />
  </FlowScreen>
);

// uncertain -> reintentos agotados: ni éxito ni falla, solo Reintentar con la misma llave.
export const TransferUncertain = () => (
  <FlowScreen
    {...reviewProps}
    title="Estado sin confirmar"
    footer={<Button label="Reintentar" onPress={noop} />}
  >
    <ReviewSummary />
    <InlineAlert
      tone="warning"
      title={UNCERTAIN_TITLE}
      message="Puede que se haya realizado. Reintenta para conocer el resultado: no se enviará dos veces."
    />
  </FlowScreen>
);

// rejected -> 422 INSUFFICIENT_FUNDS al crearla: $30,000.00 supera los $25,000.00 de Principal.
// Es mayor a $10,000.00, así que la revisión avisa del código y el flujo tiene 5 pasos.
export const TransferRejected = () => (
  <FlowScreen
    {...reviewProps}
    total={5}
    title="Transferencia rechazada"
    footer={<Button label="Corregir" variant="secondary" onPress={noop} />}
  >
    <ReviewSummary amount="$30,000.00" requiresOtp />
    <InlineAlert tone="danger" message={INSUFFICIENT_FUNDS} />
  </FlowScreen>
);

// pendingOtp -> otp-view.tsx para $15,000.00 (3 intentos), con el código ya escrito y Confirmar
// habilitado, igual que la historia de la web.
export const TransferOtp = () => (
  <FlowScreen
    title="Confirma con tu código"
    step={4}
    total={5}
    stepLabel="Código"
    footer={
      <>
        <Button label="Confirmar" onPress={noop} />
        <Button label="Reenviar código" variant="ghost" onPress={noop} />
      </>
    }
  >
    <AmountBlock
      amount="$15,000.00"
      caption={`Para ${luis.alias} · CLABE ${mask(luis.clabe)}`}
    />
    <View style={styles.list}>
      <Text style={styles.body}>Te enviamos un código de 6 dígitos a an***@example.com.</Text>
      <View style={styles.tight}>
        <Text style={styles.meta}>El código vence en 4:32.</Text>
        <Text style={styles.meta}>Te quedan 3 intentos.</Text>
      </View>
      <OtpField value="482913" onChangeText={noop} />
    </View>
  </FlowScreen>
);

// completed -> outcome-view.tsx: el comprobante con lo que devolvió la API (MOB-13).
export const TransferCompleted = () => (
  <FlowScreen
    title="Transferencia enviada"
    step={4}
    total={4}
    stepLabel="Comprobante"
    footer={
      <>
        <Button label="Ver mis cuentas" variant="secondary" onPress={noop} />
        <Button label="Hacer otra transferencia" variant="ghost" onPress={noop} />
      </>
    }
  >
    <Receipt transfer={completedTransfer} fromAccountName={principal.name} />
  </FlowScreen>
);

// failed -> outcome-view.tsx: 422 OTP_ATTEMPTS_EXHAUSTED al confirmar el código.
export const TransferFailed = () => (
  <FlowScreen
    title="La transferencia no se realizó"
    step={5}
    total={5}
    stepLabel="Comprobante"
    footer={
      <>
        <Button label="Intentar de nuevo" onPress={noop} />
        <Button label="Ver mis cuentas" variant="secondary" onPress={noop} />
      </>
    }
  >
    <InlineAlert tone="danger" message={OTP_ATTEMPTS_EXHAUSTED} />
    <Receipt transfer={failedTransfer} fromAccountName={principal.name} />
  </FlowScreen>
);
