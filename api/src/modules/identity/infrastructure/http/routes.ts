import { Router } from 'express';
import { parseBody } from '../../../../platform/http/validation.js';
import type { RegisterUser } from '../../application/register-user.js';
import { registerRequestSchema } from './schemas.js';

/** Mismo cuerpo en todas las respuestas 202, para no permitir la enumeración de cuentas. */
export const ACCEPTED_BODY = {
  message: 'Si los datos son correctos, recibirás un correo con las instrucciones.',
} as const;

export interface IdentityHandlers {
  readonly registerUser: RegisterUser;
}

/** Rutas de identidad: validan la entrada, llaman al caso de uso y traducen el resultado. */
export function identityRouter(handlers: IdentityHandlers): Router {
  const router = Router();

  router.post('/auth/register', async (req, res) => {
    const input = parseBody(registerRequestSchema, req.body);
    await handlers.registerUser.execute(input);
    res.status(202).json(ACCEPTED_BODY);
  });

  return router;
}
