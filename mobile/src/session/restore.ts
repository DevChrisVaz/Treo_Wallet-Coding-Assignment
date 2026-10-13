import type { TokenRefresher } from '@/api/client';

import type { Session } from './session';

export type RestoreOutcome = 'signedIn' | 'signedOut' | 'offline';

/**
 * Restaura la sesión al arrancar (MOB-02): sin refresh guardado, va al inicio de sesión; con uno,
 * lo renueva antes de mostrar la primera pantalla. Si la API lo revoca, el renovador limpia la
 * sesión. Sin red, conserva el refresh para que la persona reintente.
 */
export async function restoreSession(
  session: Session,
  refresher: TokenRefresher,
): Promise<RestoreOutcome> {
  const stored = await session.readRefreshToken();
  if (!stored) {
    session.markSignedOut();
    return 'signedOut';
  }
  try {
    const accessToken = await refresher.refresh();
    if (!accessToken) return 'signedOut';
    session.markSignedIn();
    return 'signedIn';
  } catch {
    return 'offline';
  }
}
