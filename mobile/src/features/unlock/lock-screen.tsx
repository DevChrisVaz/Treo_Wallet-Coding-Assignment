import { useEffect, useEffectEvent, useRef, useState } from 'react';

import { requestUnlock, useBiometricSupport, type UnlockResult } from './biometrics';
import { LockScreenView, type LockNotice } from './lock-screen-view';

interface LockScreenProps {
  onUnlock: () => void;
  /** "Usar mi contraseña", o el dispositivo ya no tiene biometría registrada (MOB-26). */
  onSignOut: () => void;
}

const LOCKOUT: LockNotice = {
  tone: 'warning',
  message: 'Demasiados intentos. Intenta más tarde o usa tu contraseña.',
};

const FAILED: LockNotice = {
  tone: 'danger',
  message: 'No pudimos verificar tu identidad. Intenta de nuevo o usa tu contraseña.',
};

/**
 * Pantalla de bloqueo (MOB-25, MOB-26, diseño D5): la marca, el aviso y las dos opciones, sin
 * saldos, movimientos ni datos personales (`LockScreenView`). Pide la biometría una sola vez al
 * aparecer; después, solo con "Desbloquear", para no encadenar diálogos si la persona cancela.
 */
export function LockScreen({ onUnlock, onSignOut }: LockScreenProps) {
  const support = useBiometricSupport();
  // Empieza pidiendo: el diálogo se abre al aparecer la pantalla.
  const [prompting, setPrompting] = useState(true);
  const [notice, setNotice] = useState<LockNotice | null>(null);
  const prompted = useRef(false);
  const mounted = useRef(false);

  function settle(result: UnlockResult) {
    // Un resultado que llega después de desmontar la pantalla ya no aplica.
    if (!mounted.current) return;
    setPrompting(false);
    switch (result) {
      case 'success':
        onUnlock();
        break;
      case 'cancelled':
        break;
      case 'lockout':
        setNotice(LOCKOUT);
        break;
      case 'unavailable':
        onSignOut();
        break;
      case 'error':
        setNotice(FAILED);
        break;
    }
  }

  const settleFirstPrompt = useEffectEvent(settle);

  useEffect(() => {
    mounted.current = true;
    if (!prompted.current) {
      prompted.current = true;
      void requestUnlock().then(settleFirstPrompt);
    }
    return () => {
      mounted.current = false;
    };
  }, []);

  async function unlock() {
    setPrompting(true);
    setNotice(null);
    settle(await requestUnlock());
  }

  return (
    <LockScreenView
      kind={support?.kind}
      prompting={prompting}
      notice={notice}
      onUnlock={() => void unlock()}
      onSignOut={onSignOut}
    />
  );
}
