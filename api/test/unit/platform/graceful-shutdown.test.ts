import { describe, expect, it } from 'vitest';
import { gracefulShutdown } from '../../../src/platform/lifecycle/graceful-shutdown.js';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
}

describe('TRF-30 apagado ordenado', () => {
  it('TRF-30 el pool se cierra solo después de terminar la pasada en curso y de cerrar el servidor', async () => {
    const events: string[] = [];
    const pass = deferred();
    const shutdown = gracefulShutdown({
      stopWork: async () => {
        events.push('detener ejecutor');
        await pass.promise;
        events.push('pasada terminada');
      },
      closeServer: async () => {
        events.push('servidor cerrado');
      },
      closePool: async () => {
        events.push('pool cerrado');
      },
    });

    const done = shutdown();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(events).not.toContain('pool cerrado');
    pass.resolve();
    await done;

    expect(events.at(-1)).toBe('pool cerrado');
    expect(events.indexOf('pasada terminada')).toBeLessThan(events.indexOf('pool cerrado'));
    expect(events.indexOf('servidor cerrado')).toBeLessThan(events.indexOf('pool cerrado'));
  });

  it('TRF-30 una segunda señal no repite el apagado', async () => {
    let closes = 0;
    const shutdown = gracefulShutdown({
      stopWork: async () => undefined,
      closeServer: async () => undefined,
      closePool: async () => {
        closes += 1;
      },
    });
    await Promise.all([shutdown(), shutdown()]);
    expect(closes).toBe(1);
  });
});
