import type { RequestHandler } from 'express';
import { routeTable } from '../../../../platform/http/auth.js';
import { parseBody } from '../../../../platform/http/validation.js';
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
}

/**
 * Rutas de identidad: validan la entrada, llaman al caso de uso y traducen el resultado. Las de
 * `/auth/*` son públicas; el resto exige access token (IDN-10).
 */
export function identityRoutes(handlers: IdentityHandlers, authenticateRequest: RequestHandler) {
  const routes = routeTable(authenticateRequest);

  routes.public.post('/auth/register', async (req, res) => {
    const input = parseBody(registerRequestSchema, req.body);
    await handlers.registerUser.execute(input);
    res.status(202).json(ACCEPTED_BODY);
  });

  routes.public.post('/auth/verify-email', async (req, res) => {
    const input = parseBody(verifyEmailRequestSchema, req.body);
    res.status(200).json(await handlers.verifyEmail.execute(input));
  });

  routes.public.post('/auth/verify-email/resend', async (req, res) => {
    const input = parseBody(resendVerificationRequestSchema, req.body);
    await handlers.resendVerification.execute(input);
    res.status(202).json(ACCEPTED_BODY);
  });

  routes.public.post('/auth/refresh', async (req, res) => {
    const input = parseBody(refreshRequestSchema, req.body);
    res.status(200).json(await handlers.refreshSession.execute(input));
  });

  routes.public.post('/auth/login', async (req, res) => {
    const input = parseBody(loginRequestSchema, req.body);
    res.status(200).json(await handlers.login.execute(input));
  });

  routes.public.post('/auth/logout', async (req, res) => {
    const input = parseBody(logoutRequestSchema, req.body);
    await handlers.logout.execute(input);
    res.status(204).end();
  });

  return routes;
}
