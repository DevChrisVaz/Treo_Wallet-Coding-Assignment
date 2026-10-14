'use client';

import { registerFormAt } from '@devchrisvaz/wallet-contract';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm, type FieldErrors, type Resolver } from 'react-hook-form';
import { register as registerUser } from '@/app/actions/auth';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { TextField } from '@/components/ui/TextField';
import { applyServerFieldErrors, digitsOnlyField, uppercaseField } from '@/lib/client/form-errors';
import { contractResolver } from '@/lib/client/form-resolver';
import { CONNECTION_ERROR, describeProblem } from '@/lib/client/problem-messages';

interface RegisterValues {
  email: string;
  password: string;
  /** Solo de la interfaz (WEB-11): debe coincidir con la contraseña y no se envía. */
  confirmPassword: string;
  fullName: string;
  curp: string;
  rfc: string;
  phone: string;
}

/** Lo que valida y envía el contrato: lo escrito, sin la confirmación y con el correo normalizado. */
type RegisterOutput = Omit<RegisterValues, 'confirmPassword'>;

const FIELDS = ['email', 'password', 'fullName', 'curp', 'rfc', 'phone'] as const;

const CONFIRM_REQUIRED = 'Confirma tu contraseña.';
const CONFIRM_MISMATCH = 'Las contraseñas no coinciden.';

/**
 * Resolver del registro (WEB-11): `registerFormAt(ahora)` del contrato para los campos que se envían (la
 * mayoría de edad cuenta desde hoy) y, aparte, que la confirmación coincida con la contraseña.
 */
const registerResolver: Resolver<RegisterValues, unknown, RegisterOutput> = async (
  values,
  context,
  options,
) => {
  const { confirmPassword, ...fields } = values;
  const base = await contractResolver<RegisterOutput, ReturnType<typeof registerFormAt>>(
    registerFormAt(new Date()),
  )(fields, context, {
    ...options,
    names: options.names?.filter((name) => name !== 'confirmPassword') as never,
  } as never);
  const errors = { ...base.errors } as FieldErrors<RegisterValues>;
  if (confirmPassword === '') {
    errors.confirmPassword = { type: 'REQUIRED', message: CONFIRM_REQUIRED };
  } else if (confirmPassword !== values.password) {
    errors.confirmPassword = { type: 'MISMATCH', message: CONFIRM_MISMATCH };
  }
  if (Object.keys(errors).length > 0) return { values: {}, errors };
  return { values: base.values as RegisterOutput, errors: {} };
};

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
    getValues,
    trigger,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues, unknown, RegisterOutput>({
    resolver: registerResolver,
    // Los errores aparecen al salir de cada campo (WEB-11) y se corrigen al teclear.
    mode: 'onTouched',
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      fullName: '',
      curp: '',
      rfc: '',
      phone: '',
    },
  });

  /** Reglas que dependen de otro campo: si ya se escribió, se revisan de nuevo al cambiar el otro. */
  function revalidate(dependent: 'confirmPassword' | 'rfc') {
    if (getValues(dependent) !== '') void trigger(dependent);
  }

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
    <>
      <form noValidate onSubmit={onSubmit} className="grid gap-4">
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
          hint="De 12 a 128 caracteres, con al menos una letra y un número."
          error={errors.password?.message}
          {...register('password', { onChange: () => revalidate('confirmPassword') })}
        />
        <TextField
          label="Confirmar contraseña"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <TextField
          label="Nombre completo"
          autoComplete="name"
          hint="Nombre y apellido, solo letras."
          error={errors.fullName?.message}
          {...register('fullName')}
        />
        <TextField
          label="CURP"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={18}
          hint="18 caracteres, como aparece en tu identificación."
          error={errors.curp?.message}
          {...uppercaseField(register('curp', { onChange: () => revalidate('rfc') }), 18)}
        />
        <TextField
          label="RFC"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={13}
          hint="13 caracteres, con homoclave."
          error={errors.rfc?.message}
          {...uppercaseField(register('rfc'), 13)}
        />
        <TextField
          label="Teléfono"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={10}
          hint="10 dígitos, sin lada ni espacios."
          error={errors.phone?.message}
          {...digitsOnlyField(register('phone'), 10)}
        />
        <Button
          type="submit"
          loading={isSubmitting}
          loadingLabel="Creando cuenta…"
          className="w-full"
        >
          Crear cuenta
        </Button>
      </form>
      <p className="text-center text-body-sm text-fg-secondary">
        ¿Ya tienes cuenta?{' '}
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center font-medium text-action underline underline-offset-2"
        >
          Inicia sesión
        </Link>
      </p>
    </>
  );
}
