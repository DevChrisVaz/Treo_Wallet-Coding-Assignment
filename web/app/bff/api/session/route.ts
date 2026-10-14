import { currentSession, endLocalSession } from '@/lib/server/session';
import { problemResponse } from '@/lib/server/read-proxy';
import { requestContextFrom } from '@/lib/server/request-context';

export const dynamic = 'force-dynamic';

/**
 * Usuario de la sesión actual, sin llamar a la API y sin tokens (WEB-01). Sin sesión responde 401,
 * que el cliente usa para llevar al inicio de sesión (WEB-22).
 */
export async function GET(request: Request): Promise<Response> {
  const current = await currentSession();
  if (!current) {
    await endLocalSession();
    return problemResponse(
      requestContextFrom(request.headers),
      401,
      'UNAUTHENTICATED',
      'Sesión terminada',
    );
  }
  return Response.json(
    { user: current.session.user },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
