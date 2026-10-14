import { useState, useSyncExternalStore } from 'react';

import { useServices } from '@/app-services';

import { requestUnlock, useBiometricSupport } from './biometrics';
import { UnlockOfferView } from './unlock-offer-view';
import { useUnlockPreference } from './use-unlock-preference';

/**
 * Oferta del desbloqueo biométrico (MOB-24, diseño D6): una tarjeta en la pantalla de inicio, y no
 * un diálogo modal, para no interrumpir y ser accesible con el lector de pantalla. Aparece después
 * de un inicio de sesión con contraseña, si la persona no ha respondido en este dispositivo y hay
 * biometría registrada. "Activar" lo activa solo si la autenticación biométrica tiene éxito; "Ahora
 * no" se guarda hasta el siguiente cierre de sesión (MOB-27).
 */
export function UnlockOffer() {
  const { unlockPreference } = useServices();
  const preference = useUnlockPreference();
  const offerPending = useSyncExternalStore(
    unlockPreference.subscribe,
    unlockPreference.isOfferPending,
  );
  const support = useBiometricSupport();
  const [activating, setActivating] = useState(false);

  if (!offerPending || preference !== null || !support?.available) return null;

  async function activate() {
    setActivating(true);
    try {
      const result = await requestUnlock('Activa el desbloqueo de TreoWallet');
      if (result === 'success') await unlockPreference.save('enabled');
    } catch {
      // Sin almacenamiento seguro, el desbloqueo sigue inactivo y la oferta sigue a la vista.
    } finally {
      setActivating(false);
    }
  }

  function decline() {
    unlockPreference.save('declined').catch(() => undefined);
  }

  return (
    <UnlockOfferView
      kind={support.kind}
      activating={activating}
      onActivate={() => void activate()}
      onDecline={decline}
    />
  );
}
