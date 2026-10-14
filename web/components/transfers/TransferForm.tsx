'use client';

import { formatMXN, type Account, type Beneficiary } from '@devchrisvaz/wallet-contract';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { AmountField } from '@/components/ui/AmountField';
import { Avatar, initials } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ListSection } from '@/components/ui/ListSection';
import { Select } from '@/components/ui/Select';
import { StepActions } from '@/components/ui/StepActions';
import { TextField } from '@/components/ui/TextField';
import type { ActionProblem } from '@/lib/action-result';
import type {
  TransferDraft,
  TransferFormValues,
  TransferRecipient,
} from '@/lib/client/transfer-flow';
import { serverFieldErrors, transferResolver } from '@/lib/client/transfer-form';
import { defaultOriginId, originsFor } from '@/lib/client/transfer-steps';
import { maskClabe } from '@/lib/money';
import { ScheduleField } from './ScheduleField';

export interface TransferFormProps {
  accounts: Account[];
  beneficiaries: Beneficiary[];
  /** A quién se envía, elegido en el paso anterior (WEB-30). */
  recipient: TransferRecipient;
  /** Lo que se había escrito, al volver de la confirmación para editar. */
  initialValues?: TransferFormValues | undefined;
  /** Acceso directo desde una cuenta (`?from=`): el origen, salvo que sea el destino (R38). */
  defaultFromAccountId?: string | undefined;
  /** Rechazo de validación de la API: sus errores se muestran junto a cada campo (WEB-33). */
  problem?: ActionProblem | undefined;
  onSubmit: (draft: TransferDraft) => void;
  /** Lo que se va escribiendo, para el resumen del dashboard. */
  onValuesChange?: ((values: TransferFormValues) => void) | undefined;
}

function defaults(props: TransferFormProps): TransferFormValues {
  if (props.initialValues) return props.initialValues;
  const { recipient } = props;
  return {
    fromAccountId: defaultOriginId(props.accounts, recipient, props.defaultFromAccountId) ?? '',
    destinationType: recipient.destinationType,
    toAccountId: recipient.destinationType === 'OWN_ACCOUNT' ? recipient.toAccountId : '',
    beneficiaryId: recipient.destinationType === 'BENEFICIARY' ? recipient.beneficiaryId : '',
    amount: '',
    concept: '',
    reference: '',
    when: 'NOW',
    scheduledFor: '',
  };
}

/**
 * "Para": el destinatario elegido, con su avatar y su CLABE enmascarada. El destino se eligió en el
 * paso anterior y aquí no tiene campo: un error de la API sobre él se muestra en esta fila (WEB-33).
 */
function RecipientRow({
  accounts,
  beneficiaries,
  recipient,
  error,
}: Pick<TransferFormProps, 'accounts' | 'beneficiaries' | 'recipient'> & {
  error?: string | undefined;
}) {
  const account =
    recipient.destinationType === 'OWN_ACCOUNT'
      ? accounts.find((item) => item.id === recipient.toAccountId)
      : undefined;
  const beneficiary =
    recipient.destinationType === 'BENEFICIARY'
      ? beneficiaries.find((item) => item.id === recipient.beneficiaryId)
      : undefined;
  const to = account
    ? { label: account.name, clabe: account.clabe }
    : beneficiary
      ? { label: beneficiary.alias, clabe: beneficiary.clabe }
      : undefined;
  return (
    <ListSection>
      <div className="flex min-h-11 items-center gap-3 py-3">
        {beneficiary ? (
          <Avatar initials={initials(beneficiary.name)} />
        ) : (
          <Avatar icon="ownTransfer" />
        )}
        <div className="grid min-w-0 flex-1 gap-1">
          <p className="text-caption text-fg-secondary">Para</p>
          {to ? (
            <p className="truncate text-label text-fg">
              {to.label} · CLABE {maskClabe(to.clabe)}
            </p>
          ) : null}
          {error ? <p className="text-caption text-danger">{error}</p> : null}
        </div>
      </div>
    </ListSection>
  );
}

/**
 * Paso de monto (WEB-30, WEB-16): a quién se envía, el monto como protagonista, la cuenta de origen
 * (sin la cuenta propia de destino), el concepto, la referencia y cuándo (ahora o en una fecha,
 * WEB-33). La validación es la del contrato; los errores de campo de la API vuelven aquí.
 */
export function TransferForm(props: TransferFormProps) {
  const { accounts, beneficiaries, recipient, problem, onSubmit, onValuesChange } = props;
  const initial = defaults(props);
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<TransferFormValues, unknown, TransferDraft>({
    resolver: transferResolver,
    defaultValues: initial,
  });

  const fromAccountId = useWatch({ control, name: 'fromAccountId' });
  const origins = originsFor(accounts, recipient);
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

  // Lo escrito, para el resumen del dashboard; `useWatch` da los valores por omisión al inicio.
  const live = useWatch({ control });
  useEffect(() => {
    onValuesChange?.(live as TransferFormValues);
  }, [live, onValuesChange]);

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="grid content-start gap-5">
      <RecipientRow
        accounts={accounts}
        beneficiaries={beneficiaries}
        recipient={recipient}
        error={errors.beneficiaryId?.message ?? errors.toAccountId?.message}
      />
      <AmountField
        variant="hero"
        label="Monto"
        hint="Hasta 2 decimales, por ejemplo 1,250.50."
        // El espejo del monto grande mide lo escrito al volver a editar (el valor lo pone el formulario).
        defaultValue={initial.amount}
        error={errors.amount?.message}
        {...register('amount')}
      />
      <Select
        label="Cuenta de origen"
        hint={origin ? `Saldo disponible: ${formatMXN(origin.balance)}` : undefined}
        error={errors.fromAccountId?.message}
        {...register('fromAccountId')}
      >
        <option value="">Elige una cuenta</option>
        {origins.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name} · {formatMXN(account.balance)}
          </option>
        ))}
      </Select>
      <TextField
        label="Concepto"
        hint="De 1 a 40 caracteres."
        autoComplete="off"
        error={errors.concept?.message}
        {...register('concept')}
      />
      <TextField
        label="Referencia"
        inputMode="numeric"
        hint="De 1 a 7 dígitos."
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
      <StepActions>
        <Button type="submit">Continuar</Button>
      </StepActions>
    </form>
  );
}
