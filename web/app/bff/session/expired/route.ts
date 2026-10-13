import { cookies } from 'next/headers';
import { loginPath, safeNextPath } from '@/lib/navigation';
import { clearSessionCookie, readSessionId } from '@/lib/server/session-cookie';
import { sessionStore } from '@/lib/server/session-store';

export const dynamic = 'force-dynamic';

/**
 * Borra la cookie de una sesión que ya no existe en el servidor y lleva al inicio de sesión con
 * "Tu sesión expiró" (WEB-03). Un layout no puede escribir cookies; por eso pasa por aquí. Si la
 * sesión sigue activa no toca nada y vuelve a la ruta pedida.
 */
export async function GET(request: Request): Promise<Response> {
  const next = safeNextPath(new URL(request.url).searchParams.get('next'));
  const jar = await cookies();
  const sessionId = readSessionId(jar);
  if (sessionId && (await sessionStore().get(sessionId))) {
    return new Response(null, { status: 303, headers: { Location: next } });
  }
  clearSessionCookie(jar);
  return new Response(null, { status: 303, headers: { Location: loginPath(next, 'expired') } });
}
