import 'server-only';

/**
 * Registra en el servidor un error no previsto con su `requestId`, en una línea JSON. El detalle
 * (mensaje y traza) solo queda en los logs; nunca se devuelve al navegador (WEB-08).
 */
export function logUnexpectedError(requestId: string, error: unknown): void {
  const detail =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { value: String(error) };
  console.error(
    JSON.stringify({
      level: 'error',
      msg: 'Error no previsto en el servidor de la web',
      requestId,
      error: detail,
    }),
  );
}
