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
import { transferResolver } from '@/lib/client/transfer-form';
import type {
  TransferDraft,
  TransferFormValues,
  TransferRecipient,
} from '@/lib/client/transfer-flow';
import { maskClabe } from '@/lib/money';

export interface TransferFormProps {
  accounts: Account[];
  beneficiaries: Beneficiary[];
  /** A quién se envía, elegido en el paso anterior (WEB-30). */
  recipient: TransferRecipient;
  /** Lo que se había escrito, al volver de la confirmación para editar. */
  initialValues?: TransferFormValues | undefined;
  /** Acceso directo desde una cuenta (`?from=`): el origen, salvo que sea el destino (R38). */
  defaultFromAccountId?: string | undefined;
  onSubmit: (draft: TransferDraft) => void;
  /** Lo que se va escribiendo, para el resumen del dashboard. */
  onValuesChange?: ((values: TransferFormValues) => void) | undefined;
}

/** Cuentas que pueden ser el origen: todas menos la cuenta propia de destino (WEB-16). */
function originsFor(accounts: Account[], recipient: TransferRecipient): Account[] {
  return accounts.filter(
    (account) =>
      !(recipient.destinationType === 'OWN_ACCOUNT' && account.id === recipient.toAccountId),
  );
}

function defaults(props: TransferFormProps): TransferFormValues {
  if (props.initialValues) return props.initialValues;
  const { recipient } = props;
  const origins = originsFor(props.accounts, recipient);
  const fromAccountId =
    origins.find((account) => account.id === props.defaultFromAccountId)?.id ??
    origins[0]?.id ??
    '';
  return {
    fromAccountId,
    destinationType: recipient.destinationType,
    toAccountId: recipient.destinationType === 'OWN_ACCOUNT' ? recipient.toAccountId : '',
    beneficiaryId: recipient.destinationType === 'BENEFICIARY' ? recipient.beneficiaryId : '',
    amount: '',
    concept: '',
    reference: '',
  };
}

/** "Para": el destinatario elegido, con su avatar y su CLABE enmascarada. */
function RecipientRow({
  accounts,
  beneficiaries,
  recipient,
}: Pick<TransferFormProps, 'accounts' | 'beneficiaries' | 'recipient'>) {
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
        </div>
      </div>
    </ListSection>
  );
}

/**
 * Paso de monto (WEB-30, WEB-16): a quién se envía, el monto como protagonista, la cuenta de origen
 * (sin la cuenta propia de destino), el concepto y la referencia. La validación es la del contrato.
 */
export function TransferForm(props: TransferFormProps) {
  const { accounts, beneficiaries, recipient, onSubmit, onValuesChange } = props;
  const initial = defaults(props);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<TransferFormValues, unknown, TransferDraft>({
    resolver: transferResolver,
    defaultValues: initial,
  });

  const fromAccountId = useWatch({ control, name: 'fromAccountId' });
  const origins = originsFor(accounts, recipient);
  const origin = accounts.find((account) => account.id === fromAccountId);

  // Lo escrito, para el resumen del dashboard; `useWatch` da los valores por omisión al inicio.
  const live = useWatch({ control });
  useEffect(() => {
    onValuesChange?.(live as TransferFormValues);
  }, [live, onValuesChange]);

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="grid content-start gap-5">
      <RecipientRow accounts={accounts} beneficiaries={beneficiaries} recipient={recipient} />
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
      <StepActions>
        <Button type="submit">Continuar</Button>
      </StepActions>
    </form>
  );
}
