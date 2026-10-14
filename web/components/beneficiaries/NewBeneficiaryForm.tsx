'use client';

import { beneficiaryForm, type BeneficiaryList } from '@devchrisvaz/wallet-contract';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { createBeneficiary } from '@/app/actions/beneficiaries';
import { Button, buttonClasses } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { TextField } from '@/components/ui/TextField';
import { applyServerFieldErrors } from '@/lib/client/form-errors';
import { contractResolver } from '@/lib/client/form-resolver';
import { CONNECTION_ERROR, describeProblem } from '@/lib/client/problem-messages';
import { queryKeys } from '@/lib/client/query-keys';

interface BeneficiaryValues {
  name: string;
  alias: string;
  clabe: string;
}

/** Rechazos de la API que se refieren a la CLABE: se muestran en ese campo (WEB-15). */
const CLABE_CODES = new Set([
  'CLABE_INVALID',
  'CLABE_NOT_IN_PLATFORM',
  'BENEFICIARY_IS_OWN_ACCOUNT',
]);

/**
 * Alta de beneficiario (WEB-15): la CLABE se valida en el formulario (18 dígitos y dígito
 * verificador) con el esquema del contrato. Al darlo de alta se agrega a la lista en caché y se
 * vuelve a la lista sin recargar la página.
 */
export function NewBeneficiaryForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<BeneficiaryValues, unknown, BeneficiaryValues>({
    resolver: contractResolver(beneficiaryForm),
    defaultValues: { name: '', alias: '', clabe: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    let result;
    try {
      result = await createBeneficiary(values);
    } catch {
      setError(CONNECTION_ERROR);
      return;
    }
    if (result.ok) {
      const created = result.data;
      queryClient.setQueryData<BeneficiaryList>(queryKeys.beneficiaries, (current) => ({
        items: [...(current?.items ?? []).filter((item) => item.id !== created.id), created].sort(
          (a, b) => a.alias.localeCompare(b.alias, 'es-MX'),
        ),
      }));
      void queryClient.invalidateQueries({ queryKey: queryKeys.beneficiaries });
      router.push('/beneficiaries');
      return;
    }
    const { problem } = result;
    if (CLABE_CODES.has(problem.code)) {
      setFieldError(
        'clabe',
        { type: 'server', message: describeProblem(problem) },
        { shouldFocus: true },
      );
      return;
    }
    if (applyServerFieldErrors(problem, setFieldError, ['name', 'alias', 'clabe'])) return;
    setError(describeProblem(problem));
  });

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="grid gap-5 dashboard:max-w-xl dashboard:rounded-lg dashboard:bg-surface dashboard:p-8 dashboard:shadow-card"
    >
      {error ? (
        <InlineAlert tone="danger" focusOnMount>
          {error}
        </InlineAlert>
      ) : null}
      <TextField
        label="Nombre del titular"
        autoComplete="off"
        error={errors.name?.message}
        {...register('name')}
      />
      <TextField
        label="Alias"
        hint="Así lo verás al transferir. Máximo 30 caracteres."
        autoComplete="off"
        error={errors.alias?.message}
        {...register('alias')}
      />
      <TextField
        label="CLABE"
        inputMode="numeric"
        autoComplete="off"
        hint="18 dígitos, de una cuenta de TreoWallet."
        className="tabular-nums"
        error={errors.clabe?.message}
        {...register('clabe')}
      />
      <div className="grid gap-3 pt-1">
        <Button type="submit" loading={isSubmitting} loadingLabel="Agregando…">
          Agregar beneficiario
        </Button>
        <Link href="/beneficiaries" className={buttonClasses('ghost')}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
