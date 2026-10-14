'use client';

import {
  formatMXN,
  otpCode,
  type Account,
  type OtpChallenge,
  type Transfer,
} from '@devchrisvaz/wallet-contract';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { confirmTransfer, resendTransferOtp } from '@/app/actions/transfers';
import { Button, buttonClasses } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { OtpField } from '@/components/ui/OtpField';
import { Receipt } from '@/components/ui/Receipt';
import { StepActions } from '@/components/ui/StepActions';
import type { ActionProblem } from '@/lib/action-result';
import { contractResolver } from '@/lib/client/form-resolver';
import { attempts, describeError, describeProblem } from '@/lib/client/problem-messages';
import { formatTime } from '@/lib/format';
import { loginPath } from '@/lib/navigation';
import { AmountBlock } from './TransferSummary';

/** Respuestas de la confirmación que terminan el intento: hay que empezar uno nuevo (WEB-18). */
const ENDING_CODES = new Set([
  'OTP_ATTEMPTS_EXHAUSTED',
  'TRANSFER_EXPIRED',
  'TRANSFER_NOT_PENDING',
  'DAILY_LIMIT_EXCEEDED',
  'INSUFFICIENT_FUNDS',
  'NOT_FOUND',
]);

const otpForm = z.object({ otp: otpCode });

interface OtpValues {
  otp: string;
}

/** `fixed`: abajo en teléfono, en el flujo (WEB-30); `inline`: en una página con pestañas (detalle). */
export type StepActionsMode = 'fixed' | 'inline';

export interface OtpStepProps {
  transfer: Transfer;
  onConfirmed: (transfer: Transfer) => void;
  onEnded: (problem: ActionProblem) => void;
  actions?: StepActionsMode | undefined;
}

/**
 * Confirmación con el código de 6 dígitos (WEB-18, WEB-30): el monto como protagonista, intentos
 * restantes, reenvío mientras queden, aviso si el correo no salió (`deliveryStatus: FAILED`) y fin del
 * intento cuando la API lo indica.
 */
export function OtpStep({ transfer, onConfirmed, onEnded, actions = 'fixed' }: OtpStepProps) {
  const router = useRouter();
  const [challenge, setChallenge] = useState<OtpChallenge | null>(transfer.otp);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [resending, setResending] = useState(false);
  const [canResend, setCanResend] = useState((transfer.otp?.resendsRemaining ?? 0) > 0);
  const inFlight = useRef(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OtpValues, unknown, OtpValues>({
    resolver: contractResolver(otpForm),
    defaultValues: { otp: '' },
  });

  function sessionEnded(problem: ActionProblem): boolean {
    if (problem.status !== 401) return false;
    router.replace(loginPath(`/transfers/${transfer.id}`, 'expired'));
    return true;
  }

  async function confirm({ otp }: OtpValues) {
    if (inFlight.current) return;
    inFlight.current = true;
    setConfirming(true);
    setError(null);
    setNotice(null);
    try {
      const result = await confirmTransfer({ transferId: transfer.id, otp });
      if (result.ok) {
        onConfirmed(result.data);
        return;
      }
      if (sessionEnded(result.problem)) return;
      if (ENDING_CODES.has(result.problem.code)) {
        onEnded(result.problem);
        return;
      }
      if (result.problem.code === 'OTP_INVALID') {
        // Los intentos que quedan también se leen junto al código, no solo en la alerta.
        const left = (result.problem as { attemptsRemaining?: unknown }).attemptsRemaining;
        if (typeof left === 'number') {
          setChallenge((current) => (current ? { ...current, attemptsRemaining: left } : current));
        }
      }
      setError(describeProblem(result.problem));
    } catch (caught) {
      // La confirmación es idempotente por estado: reintentar con el mismo código es seguro.
      setError(describeError(caught));
    } finally {
      inFlight.current = false;
      setConfirming(false);
    }
  }

  async function onResend() {
    setResending(true);
    setError(null);
    setNotice(null);
    try {
      const result = await resendTransferOtp({ transferId: transfer.id });
      if (result.ok) {
        setChallenge(result.data);
        setCanResend(result.data.resendsRemaining > 0);
        setNotice('Te enviamos un código nuevo.');
        return;
      }
      if (sessionEnded(result.problem)) return;
      if (result.problem.code === 'RESEND_LIMIT_REACHED') setCanResend(false);
      if (ENDING_CODES.has(result.problem.code)) {
        onEnded(result.problem);
        return;
      }
      setError(describeProblem(result.problem));
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setResending(false);
    }
  }

  return (
    <>
      <AmountBlock
        amount={formatMXN(transfer.amount)}
        caption={`Para ${transfer.destination.displayName} · CLABE •••• ${transfer.destination.clabeLast4}`}
      />
      {challenge?.deliveryStatus === 'FAILED' && !notice ? (
        <InlineAlert tone="warning" title="No pudimos enviarte el código">
          Pide uno nuevo con &quot;Reenviar código&quot;.
        </InlineAlert>
      ) : null}
      {notice ? <InlineAlert tone="success">{notice}</InlineAlert> : null}
      {error ? (
        <InlineAlert tone="danger" focusOnMount>
          {error}
        </InlineAlert>
      ) : null}
      <form
        noValidate
        onSubmit={(event) => void handleSubmit(confirm)(event)}
        className="grid gap-4"
      >
        {challenge ? (
          <>
            <p className="text-body text-fg">
              Te enviamos un código de 6 dígitos a {challenge.maskedDestination}.
            </p>
            <div className="grid gap-1 text-body-sm text-fg-secondary tabular-nums">
              <p>Vence a las {formatTime(challenge.expiresAt)}.</p>
              <p>{attempts(challenge.attemptsRemaining)}</p>
            </div>
          </>
        ) : null}
        <OtpField label="Código de 6 dígitos" error={errors.otp?.message} {...register('otp')} />
        <StepActions stacked={canResend} fixed={actions === 'fixed'}>
          <Button type="submit" loading={confirming} loadingLabel="Confirmando…">
            Confirmar
          </Button>
          {canResend ? (
            <Button
              variant="ghost"
              loading={resending}
              loadingLabel="Reenviando…"
              disabled={confirming}
              onClick={() => void onResend()}
            >
              Reenviar código
            </Button>
          ) : null}
        </StepActions>
      </form>
    </>
  );
}

/** Título de la alerta cuando el código lo dice; el general es el título del paso (FlowHeader). */
function endedTitle(problem: ActionProblem): string | undefined {
  if (problem.code === 'DAILY_LIMIT_EXCEEDED') return 'Superaste tu límite diario';
  if (problem.code === 'INSUFFICIENT_FUNDS') return 'Saldo insuficiente';
  return undefined;
}

/**
 * Cómo terminó la transferencia según la respuesta de la API: 422 `OTP_ATTEMPTS_EXHAUSTED` quiere
 * decir que quedó `FAILED`, y así la muestra el comprobante (como la insignia de outcome-view.tsx en la
 * app móvil). Sin un estado conocido no se muestra comprobante.
 */
const ENDED_STATUS: Partial<Record<string, Transfer['status']>> = {
  OTP_ATTEMPTS_EXHAUSTED: 'FAILED',
  DAILY_LIMIT_EXCEEDED: 'FAILED',
  INSUFFICIENT_FUNDS: 'FAILED',
  TRANSFER_EXPIRED: 'EXPIRED',
};

export interface EndedStepProps {
  problem: ActionProblem;
  /** La transferencia que se intentó confirmar, si se conoce, para su comprobante. */
  transfer: Transfer | null;
  accounts: Account[];
  onRestart: () => void;
  actions?: StepActionsMode | undefined;
}

/** Fin de un intento que no se completó: explica por qué y ofrece intentar de nuevo (WEB-18, WEB-30). */
export function EndedStep({
  problem,
  transfer,
  accounts,
  onRestart,
  actions = 'fixed',
}: EndedStepProps) {
  const status = ENDED_STATUS[problem.code];
  return (
    <>
      <InlineAlert tone="danger" title={endedTitle(problem)} focusOnMount>
        {describeProblem(problem)}
      </InlineAlert>
      {transfer && status ? (
        <Receipt
          transfer={{ ...transfer, status }}
          fromAccount={accounts.find((account) => account.id === transfer.fromAccountId)}
        />
      ) : null}
      <StepActions stacked fixed={actions === 'fixed'}>
        <Button onClick={onRestart}>Intentar de nuevo</Button>
        <Link href="/" className={buttonClasses('secondary')}>
          Ver mis cuentas
        </Link>
      </StepActions>
    </>
  );
}
