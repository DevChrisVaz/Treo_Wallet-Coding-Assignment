import { useEffect, useSyncExternalStore } from 'react';

import { useServices } from '@/app-services';
import type { UnlockPreference } from '@/session/unlock-preference';

/**
 * Preferencia del desbloqueo en memoria (MOB-24); `undefined` mientras se lee. Si nadie la ha leído
 * todavía (la puerta la lee al arrancar), la lee al montar.
 */
export function useUnlockPreference(): UnlockPreference | null | undefined {
  const { unlockPreference } = useServices();
  const value = useSyncExternalStore(unlockPreference.subscribe, unlockPreference.getSnapshot);

  useEffect(() => {
    if (unlockPreference.getSnapshot() === undefined) void unlockPreference.load();
  }, [unlockPreference]);

  return value;
}
