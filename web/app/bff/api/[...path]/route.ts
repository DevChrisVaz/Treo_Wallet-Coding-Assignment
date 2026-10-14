import { methodNotAllowed, proxyRead } from '@/lib/server/read-proxy';

// Las lecturas dependen de la sesión: nunca se prerenderizan ni se guardan en caché.
export const dynamic = 'force-dynamic';

/** Proxy de lecturas con lista blanca (WEB-09). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await params;
  return proxyRead(request, path);
}

export async function POST(request: Request): Promise<Response> {
  return methodNotAllowed(request);
}

export const PUT = POST;
export const PATCH = POST;
export const DELETE = POST;
