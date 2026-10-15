'use client';

import { verifyEmailForm } from '@devchrisvaz/wallet-contract';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { resendVerification, verifyEmail } from '@/app/actions/auth';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { OtpField } from '@/components/ui/OtpField';
import { TextField } from '@/components/ui/TextField';
import { applyServerFieldErrors } from '@/lib/client/form-errors';
import { contractResolver } from '@/lib/client/form-resolver';
import { CONNECTION_ERROR, describeProblem } from '@/lib/client/problem-messages';

/** Mismo texto tras cualquier registro: no revela si el correo ya existía (WEB-11). */
export const REGISTERED_MESSAGE =
  'Si los datos son correctos, recibirás un correo con las instrucciones.';

const RESENT_MESSAGE = 'Si el correo está registrado, te enviamos un código nuevo.';

interface VerifyValues {
  email: string;
  code: string;
}

export interface VerifyEmailFormProps {
  email?: string;
  /** Viene del registro: muestra el mensaje genérico. */
  registered?: boolean;
}

/**
 * Verificación de correo con el código de 6 dígitos y reenvío (WEB-11). Si el registro quedó en
 * revisión (`403 REGISTRATION_IN_REVIEW`), la API no devuelve sesión: la pantalla lo dice y ofrece
 * volver al inicio de sesión.
 */
export function VerifyEmailForm({ email = '', registered = false }: VerifyEmailFormProps) {
  const router = useRouter();
  const [inReview, setInReview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(registered ? REGISTERED_MESSAGE : null);
  const [resending, setResending] = useState(false);
  const {
    register,
    handleSubmit,
    getValues,
    trigger,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<VerifyValues, unknown, VerifyValues>({
    resolver: contractResolver(verifyEmailForm),
    defaultValues: { email, code: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    let result;
    try {
      result = await verifyEmail(values);
    } catch {
      setError(CONNECTION_ERROR);
      return;
    }
    if (result.ok) {
      router.replace('/');
      return;
    }
    if (result.problem.code === 'REGISTRATION_IN_REVIEW') {
      setInReview(true);
      return;
    }
    if (applyServerFieldErrors(result.problem, setFieldError, ['email', 'code'])) return;
    setError(describeProblem(result.problem));
  });

  async function onResend() {
    if (!(await trigger('email'))) return;
    setError(null);
    setResending(true);
    try {
      const result = await resendVerification({ email: getValues('email') });
      if (result.ok) setNotice(RESENT_MESSAGE);
      else setError(describeProblem(result.problem));
    } catch {
      setError(CONNECTION_ERROR);
    } finally {
      setResending(false);
    }
  }

  if (inReview) {
    return (
      <div className="grid gap-4">
        <InlineAlert tone="info" focusOnMount>
          {describeProblem({ code: 'REGISTRATION_IN_REVIEW' })}
        </InlineAlert>
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center justify-center font-medium text-action underline underline-offset-2"
        >
          Ir a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-4">
      {notice ? <InlineAlert tone="success">{notice}</InlineAlert> : null}
      {error ? (
        <InlineAlert tone="danger" focusOnMount>
          {error}
        </InlineAlert>
      ) : null}
      <TextField
        label="Correo"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register('email')}
      />
      <OtpField
        label="Código de 6 dígitos"
        hint="Lo enviamos a tu correo. Vence en 15 minutos."
        error={errors.code?.message}
        {...register('code')}
      />
      <div className="grid gap-3">
        <Button type="submit" loading={isSubmitting} loadingLabel="Verificando…">
          Verificar correo
        </Button>
        <Button variant="ghost" loading={resending} loadingLabel="Reenviando…" onClick={onResend}>
          Reenviar código
        </Button>
      </div>
    </form>
  );
}
