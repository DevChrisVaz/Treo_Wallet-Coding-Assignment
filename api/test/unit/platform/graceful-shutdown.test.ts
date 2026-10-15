import { describe, expect, it } from 'vitest';
import {
  gracefulShutdown,
  NOTICE_DRAIN_TIMEOUT_MS,
} from '../../../src/platform/lifecycle/graceful-shutdown.js';

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

describe('PLT-16 apagado ordenado con avisos en vuelo', () => {
  it('PLT-16 los avisos se esperan después de cerrar el servidor y de detener el trabajo, y antes de cerrar el pool', async () => {
    const events: string[] = [];
    const drain = deferred();
    const shutdown = gracefulShutdown({
      stopWork: async () => {
        events.push('trabajo detenido');
      },
      closeServer: async () => {
        events.push('servidor cerrado');
      },
      drainNotices: async () => {
        events.push('esperando avisos');
        await drain.promise;
        events.push('avisos enviados');
      },
      closePool: async () => {
        events.push('pool cerrado');
      },
    });

    const done = shutdown();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(events).toEqual(['trabajo detenido', 'servidor cerrado', 'esperando avisos']);
    drain.resolve();
    await done;

    expect(events.slice(-2)).toEqual(['avisos enviados', 'pool cerrado']);
  });

  it('PLT-16 la espera de los avisos tiene un tope de 5 segundos', () => {
    expect(NOTICE_DRAIN_TIMEOUT_MS).toBe(5_000);
  });

  it('PLT-16 una segunda señal no vuelve a esperar los avisos', async () => {
    let drains = 0;
    const shutdown = gracefulShutdown({
      stopWork: async () => undefined,
      closeServer: async () => undefined,
      drainNotices: async () => {
        drains += 1;
      },
      closePool: async () => undefined,
    });
    await Promise.all([shutdown(), shutdown()]);
    expect(drains).toBe(1);
  });
});
