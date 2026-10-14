import type { Account, Beneficiary } from '@devchrisvaz/wallet-contract';
import { problemMessage } from '@devchrisvaz/wallet-design-tokens';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, FlowHeader, InlineAlert, Skeleton } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import type { Loadable } from '@/lib/loadable';
import { useCountdown } from '@/lib/use-countdown';
import { theme } from '@/theme';

import { UNCERTAIN_TITLE, flowHeading, type FlowHeading } from './flow-steps';
import { FormView, type FormValues } from './form-view';
import { OtpView, otpControls, type OtpState } from './otp-view';
import { OutcomeView } from './outcome-view';
import { MAX_RETRIES } from './retry-limits';
import { ReviewView } from './review-view';
import type { AttemptState } from './transfer-attempt';

export interface TransferFlowActions {
  onClose: () => void;
  onChange: (values: FormValues) => void;
  onContinue: () => void;
  onSubmit: () => void;
  onEdit: () => void;
  onRetry: () => void;
  onCodeChange: (code: string) => void;
  onConfirm: () => void;
  onResend: () => void;
  onRestart: () => void;
  onHome: () => void;
  onAnother: () => void;
}

export interface TransferFlowViewProps {
  state: AttemptState;
  data: Loadable<{ accounts: Account[]; beneficiary: Beneficiary | undefined }>;
  values: FormValues;
  errors: Record<string, string>;
  code: string;
  actions: TransferFlowActions;
}

/** Estados del intento con datos congelados que se muestran sobre el resumen (paso de revisión). */
type ReviewState = Extract<
  AttemptState,
  { status: 'reviewing' | 'sending' | 'waitingRetry' | 'uncertain' | 'rejected' | 'error' }
>;
type RateLimitedState = Extract<AttemptState, { status: 'rateLimited' }>;

/** Pantalla de un paso: encabezado con cerrar, título y pasos; contenido; acciones fijas abajo. */
function FlowScreen({
  heading,
  onClose,
  footer,
  children,
}: {
  heading: FlowHeading;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Screen
      header={
        <FlowHeader
          title={heading.title}
          step={heading.step}
          total={heading.total}
          stepLabel={heading.label}
          onClose={onClose}
        />
      }
      footer={footer}
    >
      {children}
    </Screen>
  );
}

/**
 * Avisos del intento sobre el resumen (MOB-10, MOB-11, MOB-14). El estado incierto no se presenta
 * como éxito ni como falla.
 */
function ReviewAlert({ state }: { state: ReviewState }) {
  switch (state.status) {
    case 'waitingRetry':
      return (
        <InlineAlert
          tone="warning"
          message={`Perdimos la conexión. Reintentaremos la misma operación (${state.retry} de ${MAX_RETRIES}).`}
        />
      );
    case 'uncertain':
      return (
        <InlineAlert
          tone="warning"
          title={UNCERTAIN_TITLE}
          message="Puede que se haya realizado. Reintenta para conocer el resultado: no se enviará dos veces."
        />
      );
    case 'rejected':
    case 'error':
      return <InlineAlert tone="danger" message={errorMessage(state.error)} />;
    default:
      return null;
  }
}

/**
 * Acciones del paso de revisión (MOB-09, MOB-11). "Enviar" queda deshabilitado desde el envío hasta
 * un resultado definitivo o el estado incierto, que solo ofrece reintentar con la misma llave. Es el
 * mismo botón de revisión a envío: no se desmonta y el foco no se pierde.
 */
function ReviewFooter({ state, actions }: { state: ReviewState; actions: TransferFlowActions }) {
  switch (state.status) {
    case 'reviewing':
    case 'sending':
    case 'waitingRetry': {
      const sending = state.status !== 'reviewing';
      return (
        <>
          <Button
            label="Enviar"
            onPress={sending ? () => undefined : actions.onSubmit}
            loading={sending}
          />
          {sending ? null : <Button label="Editar" variant="ghost" onPress={actions.onEdit} />}
        </>
      );
    }
    case 'uncertain':
      return <Button label="Reintentar" onPress={actions.onRetry} />;
    case 'rejected':
    case 'error':
      return <Button label="Corregir" variant="secondary" onPress={actions.onEdit} />;
  }
}

/** Tras un `429` (MOB-10): el único estado con temporizador; el reintento manual usa la misma llave. */
function RateLimitedStep({
  heading,
  state,
  account,
  beneficiary,
  actions,
}: {
  heading: FlowHeading;
  state: RateLimitedState;
  account: Account | undefined;
  beneficiary: Beneficiary | undefined;
  actions: TransferFlowActions;
}) {
  const countdown = useCountdown(state.retryAfterSeconds);
  return (
    <FlowScreen
      heading={heading}
      onClose={actions.onClose}
      footer={
        <Button label="Reintentar" onPress={actions.onRetry} disabled={countdown.remaining > 0} />
      }
    >
      <ReviewView draft={state.draft} account={account} beneficiary={beneficiary} />
      <InlineAlert tone="warning" message={problemMessage('RATE_LIMITED')} />
      {countdown.remaining > 0 ? (
        <Text style={styles.countdown} accessibilityLiveRegion="polite">
          {`Podrás reintentar en ${countdown.remaining} s, con la misma operación.`}
        </Text>
      ) : null}
    </FlowScreen>
  );
}

/** Acciones del paso de código (MOB-12): confirmar con los 6 dígitos y, si se puede, reenviar. */
function OtpFooter({
  state,
  code,
  actions,
}: {
  state: OtpState;
  code: string;
  actions: TransferFlowActions;
}) {
  if (state.status === 'otpUncertain') {
    return <Button label="Reintentar" onPress={actions.onRetry} />;
  }
  const { busy, canResend, resending } = otpControls(state);
  return (
    <>
      <Button
        label="Confirmar"
        loading={busy}
        disabled={code.length !== 6}
        onPress={actions.onConfirm}
      />
      {canResend ? (
        <Button
          label="Reenviar código"
          variant="ghost"
          loading={resending}
          onPress={actions.onResend}
        />
      ) : null}
    </>
  );
}

/** Flujo de transferencia a partir del monto (MOB-21): lo que muestran las historias, por estado del intento. */
export function TransferFlowView({
  state,
  data,
  values,
  errors,
  code,
  actions,
}: TransferFlowViewProps) {
  const heading = flowHeading(state);
  if (data.status !== 'success') {
    return (
      <FlowScreen heading={heading} onClose={actions.onClose}>
        {data.status === 'pending' ? (
          <View style={styles.loading}>
            <Skeleton variant="line" />
            <Skeleton variant="line" />
          </View>
        ) : (
          <InlineAlert
            tone="danger"
            title="No pudimos cargar tus cuentas y beneficiarios"
            message={data.message}
          />
        )}
      </FlowScreen>
    );
  }

  const { accounts, beneficiary } = data.data;
  const accountOf = (id: string) => accounts.find((account) => account.id === id);
  switch (state.status) {
    case 'editing':
      return (
        <FlowScreen
          heading={heading}
          onClose={actions.onClose}
          footer={<Button label="Continuar" onPress={actions.onContinue} />}
        >
          <FormView
            accounts={accounts}
            beneficiary={beneficiary}
            values={values}
            errors={errors}
            onChange={actions.onChange}
          />
        </FlowScreen>
      );
    case 'rateLimited':
      return (
        <RateLimitedStep
          heading={heading}
          state={state}
          account={accountOf(state.draft.fromAccountId)}
          beneficiary={beneficiary}
          actions={actions}
        />
      );
    case 'reviewing':
    case 'sending':
    case 'waitingRetry':
    case 'uncertain':
    case 'rejected':
    case 'error':
      return (
        <FlowScreen
          heading={heading}
          onClose={actions.onClose}
          footer={<ReviewFooter state={state} actions={actions} />}
        >
          <ReviewView
            draft={state.draft}
            account={accountOf(state.draft.fromAccountId)}
            beneficiary={beneficiary}
          />
          <ReviewAlert state={state} />
        </FlowScreen>
      );
    case 'pendingOtp':
    case 'confirmingOtp':
    case 'waitingOtpRetry':
    case 'otpUncertain':
      return (
        <FlowScreen
          heading={heading}
          onClose={actions.onClose}
          footer={<OtpFooter state={state} code={code} actions={actions} />}
        >
          <OtpView state={state} code={code} onCodeChange={actions.onCodeChange} />
        </FlowScreen>
      );
    case 'completed':
      return (
        <FlowScreen
          heading={heading}
          onClose={actions.onClose}
          footer={
            <>
              <Button label="Ver mis cuentas" variant="secondary" onPress={actions.onHome} />
              <Button
                label="Hacer otra transferencia"
                variant="ghost"
                onPress={actions.onAnother}
              />
            </>
          }
        >
          <OutcomeView state={state} account={accountOf(state.transfer.fromAccountId)} />
        </FlowScreen>
      );
    case 'failed':
    case 'expired':
      return (
        <FlowScreen
          heading={heading}
          onClose={actions.onClose}
          footer={
            <>
              <Button label="Intentar de nuevo" onPress={actions.onRestart} />
              <Button label="Ver mis cuentas" variant="secondary" onPress={actions.onHome} />
            </>
          }
        >
          <OutcomeView state={state} account={accountOf(state.transfer.fromAccountId)} />
        </FlowScreen>
      );
  }
}

const styles = StyleSheet.create({
  loading: { gap: theme.spacing[4] },
  countdown: { ...theme.typography.bodySm, ...theme.amount, color: theme.colors.text.secondary },
});
