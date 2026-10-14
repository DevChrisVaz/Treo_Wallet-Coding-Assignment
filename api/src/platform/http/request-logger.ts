import type { RequestHandler } from 'express';
import type { AppLogger } from '../../shared/logger.js';
import { currentRequestContext } from '../context/request-context.js';

/**
 * Una línea por petición al terminar (PLT-06): método, ruta sin query string, status, duración,
 * `requestId` y usuario. No registra headers ni cuerpos: lo que no se escribe no se puede filtrar.
 */
export function requestLogger(logger: AppLogger): RequestHandler {
  return (req, res, next) => {
    const started = process.hrtime.bigint();
    const context = currentRequestContext();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
      const status = res.statusCode;
      const line = {
        requestId: context?.requestId,
        userId: context?.userId,
        method: req.method,
        path: req.originalUrl.split('?')[0],
        status,
        durationMs: Math.round(durationMs * 100) / 100,
      };
      if (status >= 500) logger.error(line, 'request completed');
      else logger.info(line, 'request completed');
    });
    next();
  };
}
