import { useEffect, useState, type ReactNode } from 'react';

import { useServices } from '@/app-services';
import { StartupLoading } from '@/navigation/root-navigator';
import { logout } from '@/session/logout';
import { readUnlockPreference } from '@/session/unlock-preference';

import { LockScreen } from './lock-screen';

type GateState = 'checking' | 'locked' | 'open';

interface UnlockGateProps {
  /** La navegación raíz, que restaura la sesión al montarse (MOB-02). */
  children: ReactNode;
}

/**
 * Puerta de desbloqueo (MOB-25, diseño D2). Al arrancar lee, sin ninguna petición a la API, la
 * preferencia y si hay un refresh guardado. Con el desbloqueo activo y un refresh, muestra la
 * pantalla de bloqueo y monta la navegación (que restaura la sesión) solo después del éxito
 * biométrico; si no, deja pasar y la sesión se restaura como siempre.
 */
export function UnlockGate({ children }: UnlockGateProps) {
  const { session, api } = useServices();
  const [state, setState] = useState<GateState>('checking');

  useEffect(() => {
    let active = true;
    void Promise.all([readUnlockPreference(), session.readRefreshToken()]).then(
      ([preference, refreshToken]) => {
        if (active) setState(preference === 'enabled' && refreshToken ? 'locked' : 'open');
      },
    );
    return () => {
      active = false;
    };
  }, [session]);

  if (state === 'checking') return <StartupLoading />;
  if (state === 'locked') {
    return (
      <LockScreen onUnlock={() => setState('open')} onSignOut={() => void logout(session, api)} />
    );
  }
  return <>{children}</>;
}
