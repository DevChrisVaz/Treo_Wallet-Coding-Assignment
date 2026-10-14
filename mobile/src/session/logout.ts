import type { ApiClient } from '@devchrisvaz/wallet-contract';

import type { Session } from './session';

/**
 * Cierre de sesión (MOB-04): borra primero los tokens locales, para no depender de la red, y
 * después pide a la API revocar el refresh (el endpoint no requiere access token). Si la API no
 * responde, los tokens locales ya se borraron.
 */
export async function logout(session: Session, api: ApiClient): Promise<void> {
  const refreshToken = await session.readRefreshToken();
  await session.clear('logout');
  if (!refreshToken) return;
  try {
    await api.POST('/auth/logout', { body: { refreshToken } });
  } catch {
    // Sin red o sin respuesta: el refresh vence solo y ya no existe en el dispositivo.
  }
}
