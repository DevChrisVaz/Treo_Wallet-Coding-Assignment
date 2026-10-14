import { useState } from 'react';

import { useServices } from '@/app-services';

import { requestUnlock, useBiometricSupport } from './biometrics';
import { UnlockSwitchView } from './unlock-switch-view';
import { useUnlockPreference } from './use-unlock-preference';

/**
 * Interruptor "Desbloqueo con <tipo>" (MOB-24, MOB-27, diseño D6), en el menú de la cuenta de Inicio
 * (R46).
 * Encenderlo exige la autenticación biométrica; apagarlo borra la preferencia sin pedirla y sin
 * cerrar la sesión. Sin biometría registrada aparece deshabilitado con la explicación
 * (`UnlockSwitchView`).
 */
export function UnlockSwitch() {
  const { unlockPreference } = useServices();
  const preference = useUnlockPreference();
  const support = useBiometricSupport();
  const [busy, setBusy] = useState(false);

  if (!support) return null;

  async function change(on: boolean) {
    setBusy(true);
    try {
      if (!on) {
        await unlockPreference.clear();
      } else if ((await requestUnlock('Activa el desbloqueo de TreoWallet')) === 'success') {
        await unlockPreference.save('enabled');
      }
    } catch {
      // Sin almacenamiento seguro, el interruptor se queda como estaba.
    } finally {
      setBusy(false);
    }
  }

  return (
    <UnlockSwitchView
      kind={support.kind}
      available={support.available}
      enabled={preference === 'enabled'}
      busy={busy}
      onChange={(on) => void change(on)}
    />
  );
}
