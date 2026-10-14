'use client';

import { otpCode, type OtpChallenge, type Transfer } from '@devchrisvaz/wallet-contract';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { confirmTransfer, resendTransferOtp } from '@/app/actions/transfers';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { OtpField } from '@/components/ui/OtpField';
import type { ActionProblem } from '@/lib/action-result';
import { contractResolver } from '@/lib/client/form-resolver';
import { describeError, describeProblem } from '@/lib/client/problem-messages';
import { formatTime } from '@/lib/format';
import { loginPath } from '@/lib/navigation';
import { StepHeading } from './StepHeading';

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

export interface OtpStepProps {
  transfer: Transfer;
  onConfirmed: (transfer: Transfer) => void;
  onEnded: (problem: ActionProblem) => void;
}

/**
 * Confirmación con el código de 6 dígitos (WEB-18): intentos restantes, reenvío mientras queden,
 * aviso si el correo no salió (`deliveryStatus: FAILED`) y fin del intento cuando la API lo indica.
 */
export function OtpStep({ transfer, onConfirmed, onEnded }: OtpStepProps) {
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
    <section aria-labelledby="otp-title" className="grid gap-5">
      <StepHeading id="otp-title">Ingresa el código</StepHeading>
      {challenge ? (
        <p className="text-body text-fg-secondary">
          Te enviamos un código a {challenge.maskedDestination}. Vence a las{' '}
          {formatTime(challenge.expiresAt)}.
        </p>
      ) : null}
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
        className="grid gap-5"
      >
        <OtpField label="Código de 6 dígitos" error={errors.otp?.message} {...register('otp')} />
        <div className="flex flex-wrap gap-3">
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
        </div>
      </form>
    </section>
  );
}

function endedTitle(problem: ActionProblem): string {
  if (problem.code === 'DAILY_LIMIT_EXCEEDED') return 'Superaste tu límite diario';
  if (problem.code === 'INSUFFICIENT_FUNDS') return 'Saldo insuficiente';
  return 'La transferencia no se realizó';
}

/** Fin de un intento que no se completó: explica por qué y ofrece empezar otro (WEB-18). */
export function EndedStep({
  problem,
  onRestart,
}: {
  problem: ActionProblem;
  onRestart: () => void;
}) {
  return (
    <section aria-labelledby="ended-title" className="grid gap-5">
      <StepHeading id="ended-title">La transferencia no se realizó</StepHeading>
      <InlineAlert tone="danger" title={endedTitle(problem)}>
        {describeProblem(problem)}
      </InlineAlert>
      <div>
        <Button onClick={onRestart}>Iniciar una nueva transferencia</Button>
      </div>
    </section>
  );
}
