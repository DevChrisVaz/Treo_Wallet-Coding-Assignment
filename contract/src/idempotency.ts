/**
 * Genera una llave de idempotencia (UUID) para un intento de transferencia. El consumidor la crea
 * una sola vez por intento y la reutiliza en cada reintento de ese intento.
 *
 * En entornos sin `crypto.randomUUID` (Hermes), el consumidor debe pasar un generador, por
 * ejemplo `randomUUID` de `expo-crypto`.
 */
export function createIdempotencyKey(generator?: () => string): string {
  if (generator) return generator();
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  throw new Error(
    'Este entorno no tiene crypto.randomUUID: pasa un generador de UUID a createIdempotencyKey (por ejemplo, randomUUID de expo-crypto).',
  );
}
