import { problemMessage } from '@devchrisvaz/wallet-design-tokens';
import type { ActionProblem } from '@/lib/action-result';

/** Mensaje si la Server Action no obtuvo respuesta del servidor de la web. */
export const CONNECTION_ERROR =
  'No pudimos conectar con TreoWallet. Revisa tu conexión e intenta de nuevo.';

function minutes(count: number): string {
  return count === 1 ? '1 minuto' : `${count} minutos`;
}

/** "Te quedan 2 intentos." / "Te queda 1 intento." (WEB-11, WEB-18). */
export function attempts(count: number): string {
  if (count <= 0) return 'Ya no te quedan intentos.';
  return count === 1 ? 'Te queda 1 intento.' : `Te quedan ${count} intentos.`;
}

/**
 * Mensaje para la persona usuaria según el `code` del problema (WEB-19): el texto base sale de
 * `problemMessage` del paquete de diseño (DSG-12) y la web agrega los datos variables.
 */
export function describeProblem(problem: ActionProblem): string {
  const base = problemMessage(problem.code);
  if (problem.attemptsRemaining !== undefined) {
    return `${base} ${attempts(problem.attemptsRemaining)}`;
  }
  if (problem.code === 'RATE_LIMITED' && problem.retryAfter !== undefined) {
    // Segundos a minutos enteros hacia arriba: nunca se indica esperar menos de lo pedido.
    return `${base} Intenta de nuevo en ${minutes(Math.max(1, Math.ceil(problem.retryAfter / 60)))}.`;
  }
  return base;
}
