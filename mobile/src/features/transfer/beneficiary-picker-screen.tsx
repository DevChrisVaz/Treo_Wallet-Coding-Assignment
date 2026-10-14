import { useRouter } from 'expo-router';

import { useBeneficiaries } from '@/features/accounts/queries';
import { loadable } from '@/lib/loadable';

import { RecipientView } from './recipient-view';

/**
 * Elegir un beneficiario ya registrado (MOB-07). La app no da de alta beneficiarios: sin ninguno,
 * indica registrarlos en la web. Salir del flujo vuelve a Inicio.
 */
export function BeneficiaryPickerScreen() {
  const router = useRouter();
  const beneficiaries = useBeneficiaries();

  return (
    <RecipientView
      beneficiaries={loadable(beneficiaries)}
      onRetry={() => void beneficiaries.refetch()}
      onPick={(beneficiary) =>
        router.push({ pathname: '/transfer/send', params: { beneficiaryId: beneficiary.id } })
      }
      onClose={() => router.dismissTo('/')}
    />
  );
}
