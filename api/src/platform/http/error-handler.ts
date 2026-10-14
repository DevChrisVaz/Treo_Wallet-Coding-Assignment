import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import { DomainError } from '../../shared/errors.js';
import type { AppLogger } from '../../shared/logger.js';
import { currentRequestContext } from '../context/request-context.js';
import { toProblem } from './problem.js';

/** Envía un error de dominio como `application/problem+json` (PLT-01). */
export function sendProblem(res: Response, error: DomainError, instance?: string): void {
  const requestId = currentRequestContext()?.requestId ?? String(res.getHeader('X-Request-Id'));
  const problem = toProblem(error, { requestId, ...(instance ? { instance } : {}) });
  res.status(problem.status).type('application/problem+json').send(JSON.stringify(problem));
}

/** Rutas que no existen: 404 NOT_FOUND con el mismo formato que cualquier error. */
export const notFoundHandler: RequestHandler = (req, res) => {
  sendProblem(res, new DomainError('NOT_FOUND'), req.originalUrl.split('?')[0]);
};

/** Errores de body-parser (JSON ilegible, cuerpo demasiado grande, charset): todos 4xx. */
function isBodyParserError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { type, status } = error as { type?: unknown; status?: unknown };
  return typeof type === 'string' && typeof status === 'number' && status >= 400 && status < 500;
}

/**
 * Último middleware (PLT-01, PLT-03): errores de dominio a problem+json; un cuerpo ilegible a
 * 400 MALFORMED_REQUEST (PLT-02); cualquier otro error a 500 INTERNAL_ERROR sin detalles, con la traza completa solo en el log, asociada al `requestId`.
 */
export function errorHandler(
  logger: AppLogger,
  translate: (error: unknown) => DomainError | undefined = () => undefined,
): ErrorRequestHandler {
  return (error: unknown, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    const instance = req.originalUrl.split('?')[0];
    if (error instanceof DomainError) {
      sendProblem(res, error, instance);
      return;
    }
    if (isBodyParserError(error)) {
      sendProblem(
        res,
        new DomainError('MALFORMED_REQUEST', 'El cuerpo no es JSON válido'),
        instance,
      );
      return;
    }
    const translated = translate(error);
    if (translated) {
      sendProblem(res, translated, instance);
      return;
    }
    logger.error({ err: error }, 'unhandled error');
    sendProblem(res, new DomainError('INTERNAL_ERROR'), instance);
  };
}
