'use client';

import { formatMXN, type Account, type Beneficiary } from '@devchrisvaz/wallet-contract';
import Link from 'next/link';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { AmountField } from '@/components/ui/AmountField';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { TextField } from '@/components/ui/TextField';
import type { ActionProblem } from '@/lib/action-result';
import { serverFieldErrors, transferResolver } from '@/lib/client/transfer-form';
import type { TransferDraft, TransferFormValues } from '@/lib/client/transfer-flow';
import { maskClabe } from '@/lib/money';
import { ScheduleField } from './ScheduleField';

export interface TransferFormProps {
  accounts: Account[];
  beneficiaries: Beneficiary[];
  /** Lo que se había escrito, al volver de la confirmación para editar. */
  initialValues?: TransferFormValues | undefined;
  /** Accesos directos desde una cuenta (`?from=`) o un beneficiario (`?beneficiary=`). */
  defaultFromAccountId?: string | undefined;
  defaultBeneficiaryId?: string | undefined;
  /** Rechazo de validación de la API: sus errores se muestran junto a cada campo (WEB-33). */
  problem?: ActionProblem | undefined;
  onSubmit: (draft: TransferDraft) => void;
}

function defaults(props: TransferFormProps): TransferFormValues {
  if (props.initialValues) return props.initialValues;
  const fromAccountId = props.accounts.some((a) => a.id === props.defaultFromAccountId)
    ? (props.defaultFromAccountId ?? '')
    : props.accounts.length === 1
      ? (props.accounts[0]?.id ?? '')
      : '';
  const beneficiaryId = props.beneficiaries.some((b) => b.id === props.defaultBeneficiaryId)
    ? (props.defaultBeneficiaryId ?? '')
    : '';
  return {
    fromAccountId,
    destinationType: props.beneficiaries.length > 0 ? 'BENEFICIARY' : 'OWN_ACCOUNT',
    toAccountId: '',
    beneficiaryId,
    amount: '',
    concept: '',
    reference: '',
    when: 'NOW',
    scheduledFor: '',
  };
}

/**
 * Formulario de transferencia (WEB-16): cuenta de origen, destino propio (sin la cuenta de origen) o
 * beneficiario, monto como texto, concepto y referencia. La validación es la del contrato.
 */
export function TransferForm(props: TransferFormProps) {
  const { accounts, beneficiaries, problem, onSubmit } = props;
  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    setError,
    formState: { errors },
  } = useForm<TransferFormValues, unknown, TransferDraft>({
    resolver: transferResolver,
    defaultValues: defaults(props),
  });

  const fromAccountId = useWatch({ control, name: 'fromAccountId' });
  const destinationType = useWatch({ control, name: 'destinationType' });
  const when = useWatch({ control, name: 'when' });

  // Errores de campo que devolvió la API: junto a su campo, con el foco en el primero (WEB-33).
  useEffect(() => {
    const entries = Object.entries(serverFieldErrors(problem)) as [
      keyof TransferFormValues,
      string,
    ][];
    entries.forEach(([field, message], index) => {
      setError(field, { type: 'server', message }, { shouldFocus: index === 0 });
    });
  }, [problem, setError]);
  const origin = accounts.find((account) => account.id === fromAccountId);
  const ownDestinations = accounts.filter((account) => account.id !== fromAccountId);

  const fromField = register('fromAccountId', {
    // Si el nuevo origen era el destino elegido, el destino deja de ser válido (WEB-16).
    onChange: (event: { target: { value: string } }) => {
      if (getValues('toAccountId') === event.target.value) setValue('toAccountId', '');
    },
  });

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="grid gap-5">
      <Select
        label="Cuenta de origen"
        hint={origin ? `Saldo disponible: ${formatMXN(origin.balance)}` : undefined}
        error={errors.fromAccountId?.message}
        {...fromField}
      >
        <option value="">Elige una cuenta</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name} · {formatMXN(account.balance)}
          </option>
        ))}
      </Select>

      <fieldset className="grid gap-2">
        <legend className="text-label text-fg">Destino</legend>
        <div className="flex flex-wrap gap-x-6">
          <label className="inline-flex min-h-11 items-center gap-2 text-body">
            <input
              type="radio"
              value="OWN_ACCOUNT"
              className="size-4 accent-action"
              {...register('destinationType')}
            />
            Mis cuentas
          </label>
          <label className="inline-flex min-h-11 items-center gap-2 text-body">
            <input
              type="radio"
              value="BENEFICIARY"
              className="size-4 accent-action"
              {...register('destinationType')}
            />
            Un beneficiario
          </label>
        </div>
      </fieldset>

      {destinationType === 'OWN_ACCOUNT' ? (
        <Select
          label="Cuenta de destino"
          error={errors.toAccountId?.message}
          {...register('toAccountId')}
        >
          <option value="">Elige una cuenta</option>
          {ownDestinations.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} {maskClabe(account.clabe)}
            </option>
          ))}
        </Select>
      ) : (
        <div className="grid gap-2">
          <Select
            label="Beneficiario"
            error={errors.beneficiaryId?.message}
            {...register('beneficiaryId')}
          >
            <option value="">Elige un beneficiario</option>
            {beneficiaries.map((beneficiary) => (
              <option key={beneficiary.id} value={beneficiary.id}>
                {beneficiary.alias} ({beneficiary.name}) {maskClabe(beneficiary.clabe)}
              </option>
            ))}
          </Select>
          {beneficiaries.length === 0 ? (
            <p className="text-body-sm text-fg-secondary">
              Aún no tienes beneficiarios.{' '}
              <Link href="/beneficiaries/new" className="text-action underline underline-offset-2">
                Agregar beneficiario
              </Link>
            </p>
          ) : null}
        </div>
      )}

      <AmountField
        label="Monto"
        hint="Hasta 2 decimales, por ejemplo 1,250.50."
        error={errors.amount?.message}
        {...register('amount')}
      />
      <TextField
        label="Concepto"
        hint="Hasta 40 caracteres."
        autoComplete="off"
        error={errors.concept?.message}
        {...register('concept')}
      />
      <TextField
        label="Referencia"
        inputMode="numeric"
        hint="Hasta 7 dígitos."
        autoComplete="off"
        error={errors.reference?.message}
        {...register('reference')}
      />
      <ScheduleField
        when={when}
        whenField={register('when')}
        dateField={register('scheduledFor')}
        error={errors.scheduledFor?.message}
      />
      <Button type="submit">Continuar</Button>
    </form>
  );
}
