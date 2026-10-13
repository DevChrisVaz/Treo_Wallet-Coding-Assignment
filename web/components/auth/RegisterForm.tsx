'use client';

import { registerForm } from '@devchrisvaz/wallet-contract';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { register as registerUser } from '@/app/actions/auth';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { TextField } from '@/components/ui/TextField';
import { applyServerFieldErrors, upperCase } from '@/lib/client/form-errors';
import { contractResolver } from '@/lib/client/form-resolver';
import { CONNECTION_ERROR, describeProblem } from '@/lib/client/problem-messages';

interface RegisterValues {
  email: string;
  password: string;
  fullName: string;
  curp: string;
  rfc: string;
  phone: string;
}

const FIELDS = ['email', 'password', 'fullName', 'curp', 'rfc', 'phone'] as const;

/**
 * Registro (WEB-11): los campos se validan con `registerForm` del contrato, incluido el dígito
 * verificador de la CURP. Tras enviarlo, siempre se pasa a la verificación con el mismo mensaje.
 */
export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues, unknown, RegisterValues>({
    resolver: contractResolver(registerForm),
    defaultValues: { email: '', password: '', fullName: '', curp: '', rfc: '', phone: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    let result;
    try {
      result = await registerUser(values);
    } catch {
      setError(CONNECTION_ERROR);
      return;
    }
    if (result.ok) {
      router.push(`/verify-email?email=${encodeURIComponent(values.email)}&registered=1`);
      return;
    }
    if (applyServerFieldErrors(result.problem, setFieldError, FIELDS)) return;
    setError(describeProblem(result.problem));
  });

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-5">
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
        autoComplete="new-password"
        hint="Usa al menos 12 caracteres."
        error={errors.password?.message}
        {...register('password')}
      />
      <TextField
        label="Nombre completo"
        autoComplete="name"
        error={errors.fullName?.message}
        {...register('fullName')}
      />
      <TextField
        label="CURP"
        autoCapitalize="characters"
        spellCheck={false}
        hint="18 caracteres, como aparece en tu identificación."
        error={errors.curp?.message}
        {...upperCase(register('curp'))}
      />
      <TextField
        label="RFC"
        autoCapitalize="characters"
        spellCheck={false}
        hint="13 caracteres, con homoclave."
        error={errors.rfc?.message}
        {...upperCase(register('rfc'))}
      />
      <TextField
        label="Teléfono"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        hint="10 dígitos, sin lada ni espacios."
        error={errors.phone?.message}
        {...register('phone')}
      />
      <Button type="submit" loading={isSubmitting} loadingLabel="Creando cuenta…">
        Crear cuenta
      </Button>
      <p className="text-body-sm text-fg-secondary">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="text-action underline underline-offset-2">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
