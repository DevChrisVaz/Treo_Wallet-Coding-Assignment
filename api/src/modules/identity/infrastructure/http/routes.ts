import type { RequestHandler } from 'express';
import { routeTable } from '../../../../platform/http/auth.js';
import { byIp, rateLimit } from '../../../../platform/http/rate-limit.js';
import type { Clock } from '../../../../shared/clock.js';
import { normalizeEmail } from '../../../../shared/email.js';
import { parseBody } from '../../../../platform/http/validation.js';
import type { GetCurrentUser } from '../../application/get-current-user.js';
import type { Login } from '../../application/login.js';
import type { Logout } from '../../application/logout.js';
import type { RefreshSession } from '../../application/refresh-session.js';
import type { RegisterUser } from '../../application/register-user.js';
import type { ResendVerification } from '../../application/resend-verification.js';
import type { VerifyEmail } from '../../application/verify-email.js';
import {
  loginRequestSchema,
  logoutRequestSchema,
  refreshRequestSchema,
  registerRequestSchema,
  resendVerificationRequestSchema,
  verifyEmailRequestSchema,
} from './schemas.js';

/** Mismo cuerpo en todas las respuestas 202, para no permitir la enumeración de cuentas. */
export const ACCEPTED_BODY = {
  message: 'Si los datos son correctos, recibirás un correo con las instrucciones.',
} as const;

export interface IdentityHandlers {
  readonly registerUser: RegisterUser;
  readonly verifyEmail: VerifyEmail;
  readonly resendVerification: ResendVerification;
  readonly refreshSession: RefreshSession;
  readonly login: Login;
  readonly logout: Logout;
  readonly getCurrentUser: GetCurrentUser;
}

/**
 * Rutas de identidad: validan la entrada, llaman al caso de uso y traducen el resultado. Las de
 * `/auth/*` son públicas; el resto exige access token (IDN-10).
 */
const MINUTE = 60_000;

/** Email del cuerpo para la llave del límite, antes de validar (puede venir ausente o inválido). */
function emailKey(body: unknown): string {
  const email = (body as { email?: unknown } | undefined)?.email;
  return typeof email === 'string' ? normalizeEmail(email) : '';
}

export function identityRoutes(
  handlers: IdentityHandlers,
  authenticateRequest: RequestHandler,
  clock: Clock,
) {
  const routes = routeTable(authenticateRequest);
  // Límites de identidad (IDN-15): por IP y, en el login, por IP + email. Nunca bloquean la cuenta:
  // desde otra IP el usuario puede seguir entrando.
  const loginByIpAndEmail = rateLimit({
    name: 'login-ip-email',
    windowMs: 15 * MINUTE,
    limit: 5,
    key: (req) => `${byIp(req)}|${emailKey(req.body)}`,
    clock,
  });
  const loginByIp = rateLimit({
    name: 'login-ip',
    windowMs: 15 * MINUTE,
    limit: 20,
    key: byIp,
    clock,
  });
  const perIpHourly = (name: string) =>
    rateLimit({ name, windowMs: 60 * MINUTE, limit: 10, key: byIp, clock });

  routes.public.post('/auth/register', perIpHourly('register'), async (req, res) => {
    const input = parseBody(registerRequestSchema, req.body);
    await handlers.registerUser.execute(input);
    res.status(202).json(ACCEPTED_BODY);
  });

  routes.public.post('/auth/verify-email', perIpHourly('verify-email'), async (req, res) => {
    const input = parseBody(verifyEmailRequestSchema, req.body);
    res.status(200).json(await handlers.verifyEmail.execute(input));
  });

  routes.public.post('/auth/verify-email/resend', perIpHourly('resend'), async (req, res) => {
    const input = parseBody(resendVerificationRequestSchema, req.body);
    await handlers.resendVerification.execute(input);
    res.status(202).json(ACCEPTED_BODY);
  });

  routes.public.post('/auth/refresh', async (req, res) => {
    const input = parseBody(refreshRequestSchema, req.body);
    res.status(200).json(await handlers.refreshSession.execute(input));
  });

  routes.public.post('/auth/login', loginByIp, loginByIpAndEmail, async (req, res) => {
    const input = parseBody(loginRequestSchema, req.body);
    res.status(200).json(await handlers.login.execute(input));
  });

  routes.public.post('/auth/logout', async (req, res) => {
    const input = parseBody(logoutRequestSchema, req.body);
    await handlers.logout.execute(input);
    res.status(204).end();
  });

  routes.get('/me', async (_req, res) => {
    res.status(200).json(await handlers.getCurrentUser.execute(res.locals.userId as string));
  });

  return routes;
}
