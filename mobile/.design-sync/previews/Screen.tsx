/*
 * Mapa de pantallas de la app móvil: una historia por ruta y por estado de pantalla completa,
 * portadas de `src/features/**` (JSX y StyleSheet) con los datos de `src/test-utils/*fixtures.ts`.
 * Las pantallas reales no se pueden importar (expo-router, TanStack Query, sesión), así que cada
 * historia reproduce lo que renderiza la ruta en ese estado.
 */
import type { ReactNode } from 'react';
import {
  AccountCard,
  AmountField,
  Button,
  DailyLimitMeter,
  EmptyState,
  InlineAlert,
  MovementRow,
  OptionRow,
  OtpField,
  Receipt,
  Screen,
  Select,
  Skeleton,
  StatusBadge,
  Text,
  TextField,
  View,
  Wordmark,
  theme,
  ActivityIndicator,
} from 'wallet-mobile-ui';

const noop = () => {};

// `Screen` llena a su contenedor (área segura + desplazamiento): le damos tamaño de teléfono
// (390x844, el mismo de `initialMetrics` del proveedor y de conventions.md).
const phone = { width: 390, height: 844 };

// --- Datos: src/test-utils/fixtures.ts y transfer-fixtures.ts -------------------------------

const principal = {
  id: '0b9a4f8e-1c2d-4e5f-8a9b-0c1d2e3f4a51',
  name: 'Principal',
  clabe: '646180157000009719',
  balance: '25000.00',
  // formatMXN(balance) del contrato, como lo muestra la descripción del Select.
  balanceText: '$25,000.00',
};

const ahorro = {
  id: '0b9a4f8e-1c2d-4e5f-8a9b-0c1d2e3f4a52',
  name: 'Ahorro',
  clabe: '646180157000001234',
  balance: '10000.00',
  balanceText: '$10,000.00',
};

// overview(): límite diario de 50,000.00 con 18,500.00 usados.
const dailyLimit = { limit: '50000.00', used: '18500.00', remaining: '31500.00' };

const luis = {
  id: '5d1e7c3a-9b2f-4a6e-8c0d-1e2f3a4b5c61',
  name: 'Luis Pérez',
  alias: 'Luis',
  clabe: '646180157000005678',
};

const mama = {
  id: '5d1e7c3a-9b2f-4a6e-8c0d-1e2f3a4b5c62',
  name: 'María Gómez',
  alias: 'Mamá',
  clabe: '646180157000004321',
};

// transfer(): la transferencia COMPLETED que devuelve la API para el borrador (1250, Renta, 1).
const completedTransfer = {
  id: '7f1c2a8e-5a0b-4c4e-9a59-8f0e1c2d3b4a',
  status: 'COMPLETED' as const,
  kind: 'THIRD_PARTY' as const,
  fromAccountId: principal.id,
  destination: {
    type: 'BENEFICIARY' as const,
    accountId: null,
    beneficiaryId: luis.id,
    displayName: 'Luis',
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

// pendingOtp(): 15,000.00 (mayor a 10,000.00) pide código por correo.
const pendingOtp = {
  ...completedTransfer,
  status: 'PENDING_OTP' as const,
  amount: '15000.00',
  requiresOtp: true,
  completedAt: null,
  otp: {
    channel: 'EMAIL' as const,
    deliveryStatus: 'SENT' as const,
    maskedDestination: 'an***@example.com',
    expiresAt: '2026-10-13T16:46:00Z',
    attemptsRemaining: 3,
    resendsRemaining: 3,
  },
};

// Últimos movimientos de Principal (forma de `Movement` del contrato).
const movements = [
  {
    id: 'mv_01JAH0P6Z8F2',
    type: 'TRANSFER_OUT' as const,
    amount: '-1250.00',
    balanceAfter: '21050.00',
    concept: 'Renta',
    reference: '1',
    counterparty: { name: 'Luis', clabeLast4: '5678' },
    transferId: '9b3e4c0a-7c2d-4e6a-8c7b-0a2f3e4d5c6b',
    occurredAt: '2026-10-13T16:42:00Z',
  },
  {
    id: 'mv_01JAG7W1K3E8',
    type: 'TRANSFER_OUT' as const,
    amount: '-150.00',
    balanceAfter: '22300.00',
    concept: 'Despensa',
    reference: '1',
    counterparty: { name: 'Mamá', clabeLast4: '4321' },
    transferId: '7f1c2a8e-5a0b-4c4e-9a59-8f0e1c2d3b4a',
    occurredAt: '2026-10-13T01:05:00Z',
  },
  {
    id: 'mv_01JAB2T5N9D4',
    type: 'TRANSFER_IN' as const,
    amount: '450.00',
    balanceAfter: '22450.00',
    concept: 'Pago de la comida',
    reference: '9',
    counterparty: { name: 'Andrea Ruiz', clabeLast4: '8842' },
    transferId: '3b5d7f9a-1c2e-4b4d-8f6a-0c2e4a6b8d91',
    occurredAt: '2026-10-09T23:10:00Z',
  },
  {
    id: 'mv_01JA4M8R2X6C',
    type: 'OWN_TRANSFER_OUT' as const,
    amount: '-3000.00',
    balanceAfter: '22000.00',
    concept: 'Ahorro quincenal',
    reference: '15',
    counterparty: { name: 'Ahorro', clabeLast4: '1234' },
    transferId: '8a2d3b9f-6b1c-4d5f-9b6a-9f1e2d3c4b5a',
    occurredAt: '2026-10-05T18:20:00Z',
  },
  {
    id: 'mv_01J9ZK3A7Q2B',
    type: 'DEPOSIT' as const,
    amount: '25000.00',
    balanceAfter: '25000.00',
    concept: 'Depósito inicial',
    reference: '0',
    counterparty: null,
    transferId: '2c4e6a8b-0d1f-4a3c-9e5b-7d9f1b3c5e70',
    occurredAt: '2026-09-30T15:05:00Z',
  },
];

// --- Textos: errorMessage() de src/lib/errors.ts con problemMessages del paquete de diseño ----

const NETWORK_ERROR_MESSAGE =
  'No pudimos conectar con TreoWallet. Revisa tu conexión e intenta de nuevo.';
const UNCERTAIN_TITLE = 'No pudimos confirmar el estado de tu transferencia';
const RATE_LIMITED = 'Hiciste demasiados intentos. Espera un momento y vuelve a intentar.';
const OTP_ATTEMPTS_EXHAUSTED = 'Agotaste los intentos. Cancelamos la transferencia.';
const DAILY_LIMIT_EXCEEDED = 'Esta transferencia supera lo que te queda del límite de hoy.';

// maskClabe() de src/lib/display.ts.
const mask = (clabe: string) => `•••• ${clabe.slice(-4)}`;

// --- Estilos: StyleSheet de cada pantalla ------------------------------------------------------

const styles = {
  // home-screen.tsx / login-screen.tsx / movements-screen.tsx / beneficiary-picker / transfer-flow
  header: { gap: theme.spacing[2] },
  headerTight: { gap: theme.spacing[1] },
  loginHeader: { gap: theme.spacing[2], paddingTop: theme.spacing[8] },
  title: { ...theme.typography.h1, color: theme.colors.text.primary },
  overline: { ...theme.typography.label, color: theme.colors.text.secondary },
  subtitle: { ...theme.typography.body, color: theme.colors.text.secondary },
  list: { gap: theme.spacing[4] },
  pickerList: { gap: theme.spacing[2] },
  hint: {
    ...theme.typography.caption,
    color: theme.colors.text.muted,
    textAlign: 'center' as const,
  },
  countdown: { ...theme.typography.bodySm, ...theme.amount, color: theme.colors.text.secondary },
  // form-view.tsx / outcome-view.tsx / otp-view.tsx
  stack: { gap: theme.spacing[4] },
  body: { ...theme.typography.body, color: theme.colors.text.primary },
  meta: { ...theme.typography.bodySm, ...theme.amount, color: theme.colors.text.secondary },
  // review-view.tsx
  amount: { ...theme.typography.display, ...theme.amount, color: theme.colors.text.primary },
  summary: {
    gap: theme.spacing[3],
    padding: theme.spacing[5],
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface.subtle,
  },
  row: { gap: theme.spacing[1] },
  rowLabel: { ...theme.typography.caption, color: theme.colors.text.secondary },
  rowValue: { ...theme.typography.body, color: theme.colors.text.primary },
  // root-navigator.tsx (StartupOffline)
  startup: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: theme.spacing[4],
    padding: theme.spacing[6],
    backgroundColor: theme.colors.surface.default,
  },
  startupTitle: {
    ...theme.typography.h3,
    color: theme.colors.text.primary,
    textAlign: 'center' as const,
  },
  startupBody: {
    ...theme.typography.body,
    color: theme.colors.text.secondary,
    textAlign: 'center' as const,
  },
};

// --- Piezas compartidas de las pantallas ------------------------------------------------------

/** Pie de la pantalla de inicio (home-screen.tsx). */
const homeFooter = (
  <>
    <Button label="Transferir" onPress={noop} />
    <Button label="Cerrar sesión" variant="ghost" onPress={noop} />
  </>
);

/** Pie del selector de beneficiario y del flujo de transferencia. */
const cancelFooter = <Button label="Cancelar" variant="ghost" onPress={noop} />;

function HomeHeader() {
  return (
    <View style={styles.header}>
      <Wordmark variant="compact" />
      <Text style={styles.title} accessibilityRole="header">
        Tus cuentas
      </Text>
    </View>
  );
}

function MovementsHeader() {
  return (
    <View style={styles.headerTight}>
      <Text style={styles.overline}>Últimos movimientos</Text>
      <Text style={styles.title} accessibilityRole="header">
        {principal.name}
      </Text>
    </View>
  );
}

function LoginHeader() {
  return (
    <View style={styles.loginHeader}>
      <Wordmark />
      <Text style={styles.title} accessibilityRole="header">
        Inicia sesión
      </Text>
      <Text style={styles.subtitle}>Usa el correo y la contraseña de tu cuenta TreoWallet.</Text>
    </View>
  );
}

const loginNote = (
  <Text style={styles.hint}>
    ¿Aún no tienes cuenta? El registro y la verificación del correo se hacen en la web de
    TreoWallet.
  </Text>
);

/** Encabezado de transfer-flow-screen.tsx: el título sale de TITLES[state.status]. */
function TransferHeader({ title }: { title: string }) {
  return (
    <View style={styles.headerTight}>
      <Text style={styles.overline}>Transferir</Text>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.subtitle}>{`Para ${luis.alias} · CLABE ${mask(luis.clabe)}`}</Text>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

/** review-view.tsx: monto, resumen y aviso de código; `children` son las AttemptActions. */
function ReviewSummary({
  amountText,
  concept,
  reference,
  requiresOtp = false,
  children,
}: {
  amountText: string;
  concept: string;
  reference: string;
  requiresOtp?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={styles.stack}>
      <Text style={styles.amount}>{amountText}</Text>
      <View style={styles.summary}>
        <SummaryRow label="Desde" value={`${principal.name} · ${mask(principal.clabe)}`} />
        <SummaryRow label="Para" value={`${luis.alias} · ${mask(luis.clabe)}`} />
        <SummaryRow label="Concepto" value={concept} />
        <SummaryRow label="Referencia" value={reference} />
      </View>
      {requiresOtp ? (
        <InlineAlert
          tone="info"
          message="Como el monto es mayor a $10,000.00, te enviaremos un código de confirmación a tu correo."
        />
      ) : null}
      {children}
    </View>
  );
}

// --- Inicio de sesión: src/app/login.tsx -> features/auth/login-screen.tsx -------------------

export const LoginScreen = () => (
  <View style={phone}>
    <Screen>
      <LoginHeader />
      <TextField label="Correo" variant="email" value="" onChangeText={noop} returnKeyType="next" />
      <TextField
        label="Contraseña"
        variant="password"
        value=""
        onChangeText={noop}
        returnKeyType="go"
      />
      <Button label="Iniciar sesión" onPress={noop} />
      {loginNote}
    </Screen>
  </View>
);

// 429 con Retry-After: aviso, cuenta regresiva y botón deshabilitado (la contraseña se conserva).
export const LoginRateLimited = () => (
  <View style={phone}>
    <Screen>
      <LoginHeader />
      <InlineAlert tone="warning" message={RATE_LIMITED} />
      <TextField
        label="Correo"
        variant="email"
        value="ana@example.com"
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
      {loginNote}
    </Screen>
  </View>
);

// --- Arranque: navigation/root-navigator.tsx (StartupLoading y StartupOffline, sin Screen) -----

export const StartupLoading = () => (
  <View style={phone}>
    <View style={styles.startup} accessibilityLabel="Cargando">
      <Wordmark />
      <ActivityIndicator color={theme.colors.action.primary} />
    </View>
  </View>
);


export const StartupOffline = () => (
  <View style={phone}>
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

// --- Tus cuentas: src/app/(app)/index.tsx -> features/accounts/home-screen.tsx ---------------

export const HomeScreen = () => (
  <View style={phone}>
    <Screen footer={homeFooter}>
      <HomeHeader />
      <View style={styles.list}>
        <DailyLimitMeter dailyLimit={dailyLimit} />
        {[principal, ahorro].map((account) => (
          <AccountCard
            key={account.id}
            name={account.name}
            clabe={account.clabe}
            balance={account.balance}
            onPress={noop}
          />
        ))}
        <Text style={styles.hint}>Toca una cuenta para ver sus últimos movimientos.</Text>
      </View>
    </Screen>
  </View>
);

export const HomeEmpty = () => (
  <View style={phone}>
    <Screen footer={homeFooter}>
      <HomeHeader />
      <EmptyState
        title="Aún no tienes cuentas"
        description="Cuando tu cuenta esté lista, aquí verás su saldo."
      />
    </Screen>
  </View>
);

export const HomeLoading = () => (
  <View style={phone}>
    <Screen footer={homeFooter}>
      <HomeHeader />
      <View style={styles.list}>
        <Skeleton variant="line" />
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </View>
    </Screen>
  </View>
);

// La consulta falló (sin red): no se muestran saldos anteriores, solo el error y Reintentar.
export const HomeError = () => (
  <View style={phone}>
    <Screen footer={homeFooter}>
      <HomeHeader />
      <View style={styles.list}>
        <InlineAlert tone="danger" message={NETWORK_ERROR_MESSAGE} />
        <Button label="Reintentar" variant="secondary" onPress={noop} />
      </View>
    </Screen>
  </View>
);

// --- Movimientos: src/app/(app)/accounts/[accountId].tsx -> features/accounts/movements-screen

export const MovementsScreen = () => (
  <View style={phone}>
    <Screen footer={<Button label="Volver" variant="ghost" onPress={noop} />}>
      <MovementsHeader />
      <View>
        {movements.map((movement) => (
          <MovementRow key={movement.id} movement={movement} />
        ))}
      </View>
    </Screen>
  </View>
);

export const MovementsEmpty = () => (
  <View style={phone}>
    <Screen footer={<Button label="Volver" variant="ghost" onPress={noop} />}>
      <MovementsHeader />
      <EmptyState
        title="Aún no hay movimientos"
        description="Aquí verás los depósitos y las transferencias de esta cuenta."
      />
    </Screen>
  </View>
);

// --- Beneficiario: src/app/(app)/transfer/index.tsx -> features/transfer/beneficiary-picker ---

function PickerHeader() {
  return (
    <View style={styles.headerTight}>
      <Text style={styles.overline}>Transferir</Text>
      <Text style={styles.title} accessibilityRole="header">
        ¿A quién le envías?
      </Text>
    </View>
  );
}

export const BeneficiaryPickerScreen = () => (
  <View style={phone}>
    <Screen footer={cancelFooter}>
      <PickerHeader />
      <View style={styles.pickerList}>
        {[luis, mama].map((beneficiary) => (
          <OptionRow
            key={beneficiary.id}
            option={{
              value: beneficiary.id,
              label: beneficiary.alias,
              description: `${beneficiary.name} · CLABE ${mask(beneficiary.clabe)}`,
            }}
            onPress={noop}
          />
        ))}
      </View>
    </Screen>
  </View>
);

// La app no da de alta beneficiarios: sin ninguno, indica registrarlos en la web.
export const BeneficiaryPickerEmpty = () => (
  <View style={phone}>
    <Screen footer={cancelFooter}>
      <PickerHeader />
      <EmptyState
        title="Aún no tienes beneficiarios"
        description="Regístralos en la web de TreoWallet para poder enviarles dinero desde aquí."
      />
    </Screen>
  </View>
);

// --- Transferencia: src/app/(app)/transfer/send.tsx -> features/transfer/transfer-flow-screen

// editing -> form-view.tsx (la cuenta de origen arranca en la primera cuenta).
export const TransferFormScreen = () => (
  <View style={phone}>
    <Screen footer={cancelFooter}>
      <TransferHeader title="¿Cuánto envías?" />
      <View style={styles.stack}>
        <Select
          label="Cuenta de origen"
          placeholder="Elige una cuenta"
          options={[principal, ahorro].map((account) => ({
            value: account.id,
            label: account.name,
            description: `CLABE ${mask(account.clabe)} · ${account.balanceText}`,
          }))}
          value={principal.id}
          onChange={noop}
        />
        <AmountField
          label="Monto"
          value=""
          onChangeText={noop}
          help="Hasta 2 decimales, sin comas."
        />
        <TextField label="Concepto" value="" onChangeText={noop} help="De 1 a 40 caracteres." />
        <TextField
          label="Referencia"
          value=""
          onChangeText={noop}
          help="De 1 a 7 dígitos."
          keyboardType="number-pad"
          inputMode="numeric"
        />
        <Button label="Continuar" onPress={noop} />
      </View>
    </Screen>
  </View>
);

// reviewing -> review-view.tsx + attempt-actions (Enviar / Editar).
export const TransferReviewScreen = () => (
  <View style={phone}>
    <Screen footer={cancelFooter}>
      <TransferHeader title="Revisa tu transferencia" />
      <ReviewSummary amountText="$1,250.00" concept="Renta" reference="1">
        <Button label="Enviar" onPress={noop} />
        <Button label="Editar" variant="ghost" onPress={noop} />
      </ReviewSummary>
    </Screen>
  </View>
);

// waitingRetry -> se perdió la red: misma operación, Enviar ocupado (caso borde del enunciado).
export const TransferRetryingScreen = () => (
  <View style={phone}>
    <Screen footer={cancelFooter}>
      <TransferHeader title="Enviando tu transferencia" />
      <ReviewSummary amountText="$1,250.00" concept="Renta" reference="1">
        <InlineAlert
          tone="warning"
          message="Perdimos la conexión. Reintentaremos la misma operación (1 de 5)."
        />
        <Button label="Enviar" onPress={noop} loading />
      </ReviewSummary>
    </Screen>
  </View>
);

// uncertain -> reintentos agotados: ni éxito ni falla, solo Reintentar con la misma llave.
export const TransferUncertainScreen = () => (
  <View style={phone}>
    <Screen footer={cancelFooter}>
      <TransferHeader title="Estado sin confirmar" />
      <ReviewSummary amountText="$1,250.00" concept="Renta" reference="1">
        <InlineAlert
          tone="warning"
          title={UNCERTAIN_TITLE}
          message="Puede que se haya realizado. Reintenta para conocer el resultado: no se enviará dos veces."
        />
        <Button label="Reintentar" onPress={noop} />
      </ReviewSummary>
    </Screen>
  </View>
);

// rejected -> 422 DAILY_LIMIT_EXCEEDED (datos de sending-states.test): mensaje y Corregir.
export const TransferRejectedScreen = () => (
  <View style={phone}>
    <Screen footer={cancelFooter}>
      <TransferHeader title="Transferencia rechazada" />
      <ReviewSummary amountText="$6,000.00" concept="Renta" reference="1">
        <InlineAlert tone="danger" message={`${DAILY_LIMIT_EXCEEDED} Hoy te quedan $5,000.00.`} />
        <Button label="Corregir" variant="secondary" onPress={noop} />
      </ReviewSummary>
    </Screen>
  </View>
);

// pendingOtp -> otp-view.tsx con pendingOtp() (correo enviado, 3 intentos, 3 reenvíos).
export const TransferOtpScreen = () => (
  <View style={phone}>
    <Screen footer={cancelFooter}>
      <TransferHeader title="Confirma con tu código" />
      <View style={styles.stack}>
        <Text style={styles.body}>
          {`Te enviamos un código de 6 dígitos a ${pendingOtp.otp.maskedDestination}.`}
        </Text>
        <Text style={styles.meta}>El código vence en 4:32.</Text>
        <Text style={styles.meta}>{`Te quedan ${pendingOtp.otp.attemptsRemaining} intentos.`}</Text>
        <OtpField value="" onChangeText={noop} />
        <Button label="Confirmar" onPress={noop} disabled />
        <Button label="Reenviar código" variant="ghost" onPress={noop} />
      </View>
    </Screen>
  </View>
);

// completed -> outcome-view.tsx: comprobante con lo que devolvió la API.
export const TransferCompletedScreen = () => (
  <View style={phone}>
    <Screen footer={cancelFooter}>
      <TransferHeader title="Transferencia enviada" />
      <View style={styles.stack}>
        <Receipt transfer={completedTransfer} fromAccountName={principal.name} />
        <Button label="Ir a mis cuentas" variant="secondary" onPress={noop} />
      </View>
    </Screen>
  </View>
);

// failed -> outcome-view.tsx: 422 OTP_ATTEMPTS_EXHAUSTED tras el código (otp-screen.test).
export const TransferFailedScreen = () => (
  <View style={phone}>
    <Screen footer={cancelFooter}>
      <TransferHeader title="La transferencia no se realizó" />
      <View style={styles.stack}>
        <StatusBadge status="FAILED" />
        <InlineAlert tone="danger" message={OTP_ATTEMPTS_EXHAUSTED} />
        <Button label="Intentar de nuevo" onPress={noop} />
        <Button label="Ir a mis cuentas" variant="secondary" onPress={noop} />
      </View>
    </Screen>
  </View>
);
