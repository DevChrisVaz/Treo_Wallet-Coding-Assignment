'use client';

import { loginForm } from '@devchrisvaz/wallet-contract';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { login } from '@/app/actions/auth';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { TextField } from '@/components/ui/TextField';
import { contractResolver } from '@/lib/client/form-resolver';
import { describeProblem } from '@/lib/client/problem-messages';

interface LoginValues {
  email: string;
  password: string;
}

/** Mensaje si la Server Action no obtuvo respuesta del servidor de la web. */
export const CONNECTION_ERROR =
  'No pudimos conectar con TreoWallet. Revisa tu conexión e intenta de nuevo.';

export interface LoginFormProps {
  /** Ruta interna a la que se vuelve después de iniciar sesión (ya saneada). */
  redirectTo?: string;
  notice?: 'expired';
}

/** Inicio de sesión (WEB-12) con la validación del contrato en el formulario. */
export function LoginForm({ redirectTo = '/', notice }: LoginFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues, unknown, LoginValues>({
    resolver: contractResolver(loginForm),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    let result;
    try {
      result = await login(values);
    } catch {
      setError(CONNECTION_ERROR);
      return;
    }
    if (result.ok) {
      router.replace(redirectTo);
      return;
    }
    if (result.problem.code === 'EMAIL_NOT_VERIFIED') {
      router.push(`/verify-email?email=${encodeURIComponent(values.email)}`);
      return;
    }
    setError(describeProblem(result.problem));
  });

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-5">
      {notice === 'expired' ? (
        <InlineAlert tone="info" title="Tu sesión expiró">
          Inicia sesión de nuevo para continuar.
        </InlineAlert>
      ) : null}
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
      <TextField
        label="Contraseña"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register('password')}
      />
      <Button type="submit" loading={isSubmitting} loadingLabel="Entrando…">
        Iniciar sesión
      </Button>
      <p className="text-body-sm text-fg-secondary">
        ¿No tienes cuenta?{' '}
        <Link href="/register" className="text-action underline underline-offset-2">
          Regístrate
        </Link>
      </p>
    </form>
  );
}
