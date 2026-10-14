import { Router } from 'express';

/**
 * `GET /health` (PLT-10): el proceso está vivo y listo. No toca la base de datos, para que un
 * balanceador no saque de servicio todas las instancias por una falla momentánea de PostgreSQL.
 */
export function healthRouter(): Router {
  const router = Router();
  router.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  return router;
}
