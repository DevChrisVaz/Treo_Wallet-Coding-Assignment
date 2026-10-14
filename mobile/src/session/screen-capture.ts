import * as ScreenCapture from 'expo-screen-capture';
import { useEffect } from 'react';

import { useSessionSnapshot } from '@/app-services';

export const SCREEN_CAPTURE_KEY = 'treowallet-session';

/**
 * Mientras hay sesión, impide capturas de pantalla (MOB-16, diseño 8). En Android activa
 * `FLAG_SECURE`, que además deja en blanco la miniatura del selector de apps, donde `AppState` no
 * avisa a tiempo para la pantalla de privacidad. Al cerrar sesión las vuelve a permitir.
 */
export function useScreenCaptureProtection(): void {
  const { status } = useSessionSnapshot();

  useEffect(() => {
    if (status === 'unknown') return;
    const change =
      status === 'signedIn'
        ? ScreenCapture.preventScreenCaptureAsync(SCREEN_CAPTURE_KEY)
        : ScreenCapture.allowScreenCaptureAsync(SCREEN_CAPTURE_KEY);
    // Si el sistema no lo permite, la pantalla de privacidad sigue protegiendo el contenido.
    change.catch(() => undefined);
  }, [status]);
}
