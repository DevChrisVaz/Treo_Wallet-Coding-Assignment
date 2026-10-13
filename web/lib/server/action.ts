import 'server-only';
import {
  NetworkError,
  ProblemError,
  toFieldErrors,
  type ApiClient,
  type FieldError,
} from '@devchrisvaz/wallet-contract';
import { cookies } from 'next/headers';
import type * as z from 'zod';
import type { ActionProblem, ActionResult } from '@/lib/action-result';
import { publicApi, retryAfterOf, SessionEndedError, sessionApi } from './api-client';
import { logUnexpectedError } from './log';
import { getRequestContext, type RequestContext } from './request-context';
import { clearSessionCookie, readSessionId } from './session-cookie';
import { sessionStore, type SessionData } from './session-store';

/*
 * Envoltorio común de las Server Actions (D4 y D5 de web-app). Cada acción es un endpoint público:
 * valida la entrada con el esquema del contrato, exige la sesión cuando corresponde, llama a la API
 * y devuelve el resultado como valor. La protección de origen (CSRF) la da Next.js al comparar
 * Origin con Host, con `serverActions.allowedOrigins` para proxies (WEB-06).
 */

type CookieJar = Awaited<ReturnType<typeof cookies>>;
type Schema = z.ZodType | null;
type Parsed<S extends Schema> = S extends z.ZodType ? z.output<S> : undefined;

export interface PublicActionContext<D> {
  data: D;
  request: RequestContext;
  api: ApiClient;
  cookies: CookieJar;
}

export interface SessionActionContext<D> extends PublicActionContext<D> {
  sessionId: string;
  session: SessionData;
}

class ValidationFailed extends Error {
  constructor(readonly errors: FieldError[]) {
    super('VALIDATION_FAILED');
  }
}

function parse<S extends Schema>(schema: S, input: unknown): Parsed<S> {
  if (!schema) return undefined as Parsed<S>;
  const result = schema.safeParse(input);
  if (!result.success) throw new ValidationFailed(toFieldErrors(result.error));
  return result.data as Parsed<S>;
}

/** Sesión activa de la cookie; renueva su plazo de inactividad (WEB-03). */
export async function currentSession(): Promise<{
  sessionId: string;
  session: SessionData;
} | null> {
  const sessionId = readSessionId(await cookies());
  if (!sessionId) return null;
  const store = sessionStore();
  const session = await store.get(sessionId);
  if (!session) return null;
  await store.touch(sessionId, new Date());
  return { sessionId, session };
}

/** Igual que `currentSession`, pero sin sesión falla con `UNAUTHENTICATED` (WEB-07, WEB-22). */
export async function requireSession(): Promise<{ sessionId: string; session: SessionData }> {
  const current = await currentSession();
  if (!current) throw new SessionEndedError('UNAUTHENTICATED');
  return current;
}

/** Cierra la sesión local: la elimina del servidor y borra la cookie. */
export async function endLocalSession(jar?: CookieJar): Promise<void> {
  const store = jar ?? (await cookies());
  const sessionId = readSessionId(store);
  if (sessionId) await sessionStore().delete(sessionId);
  clearSessionCookie(store);
}

function problem(
  request: RequestContext,
  fields: Pick<ActionProblem, 'type' | 'title' | 'status' | 'code'> & Partial<ActionProblem>,
): ActionProblem {
  return { requestId: request.requestId, ...fields };
}

/** Copia del `ProblemError` solo los campos que la interfaz usa; nada interno. */
function fromProblemError(error: ProblemError, request: RequestContext): ActionProblem {
  const optional: Partial<ActionProblem> = {
    detail: error.detail,
    errors: error.errors,
    transferId: error.transferId,
    transferStatus: error.transferStatus,
    remaining: error.remaining,
    attemptsRemaining: error.attemptsRemaining,
    retryAfter: retryAfterOf(error),
  };
  const defined = Object.fromEntries(
    Object.entries(optional).filter(([, value]) => value !== undefined),
  ) as Partial<ActionProblem>;
  return {
    type: error.type ?? 'about:blank',
    title: error.title,
    status: error.status,
    code: error.code,
    requestId: error.requestId ?? request.requestId,
    ...defined,
  };
}

async function guard<T>(
  request: RequestContext,
  withSession: boolean,
  run: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    if (error instanceof ValidationFailed) {
      return {
        ok: false,
        problem: problem(request, {
          type: '/problems/validation-failed',
          title: 'Datos inválidos',
          status: 422,
          code: 'VALIDATION_FAILED',
          errors: error.errors,
        }),
      };
    }
    if (error instanceof SessionEndedError) {
      await endLocalSession();
      return {
        ok: false,
        problem: problem(request, {
          type: `/problems/${error.code === 'SESSION_REVOKED' ? 'session-revoked' : 'unauthenticated'}`,
          title: 'Sesión terminada',
          status: 401,
          code: error.code,
        }),
      };
    }
    if (error instanceof ProblemError) {
      // La API rechazó el token de la sesión: la sesión local ya no sirve.
      if (withSession && error.status === 401) await endLocalSession();
      return { ok: false, problem: fromProblemError(error, request) };
    }
    if (error instanceof NetworkError) {
      logUnexpectedError(request.requestId, error);
      return {
        ok: false,
        problem: problem(request, {
          type: '/problems/service-unavailable',
          title: 'Servicio no disponible',
          status: 503,
          code: 'INTERNAL_ERROR',
        }),
      };
    }
    logUnexpectedError(request.requestId, error);
    return {
      ok: false,
      problem: problem(request, {
        type: '/problems/internal-error',
        title: 'Error interno',
        status: 500,
        code: 'INTERNAL_ERROR',
      }),
    };
  }
}

/** Acción sin sesión (registro, verificación, login). */
export async function publicAction<S extends Schema, T>(
  schema: S,
  input: unknown,
  work: (context: PublicActionContext<Parsed<S>>) => Promise<T>,
): Promise<ActionResult<T>> {
  const request = await getRequestContext();
  return guard(request, false, async () => {
    const data = parse(schema, input);
    return work({ data, request, api: publicApi(request), cookies: await cookies() });
  });
}

/** Acción que exige sesión: valida, comprueba la sesión y llama a la API con su Bearer. */
export async function sessionAction<S extends Schema, T>(
  schema: S,
  input: unknown,
  work: (context: SessionActionContext<Parsed<S>>) => Promise<T>,
): Promise<ActionResult<T>> {
  const request = await getRequestContext();
  return guard(request, true, async () => {
    const data = parse(schema, input);
    const { sessionId, session } = await requireSession();
    return work({
      data,
      request,
      api: sessionApi(sessionId, request),
      cookies: await cookies(),
      sessionId,
      session,
    });
  });
}
