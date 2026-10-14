import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PeriodicTask } from '../../../src/platform/scheduling/periodic-task.js';
import { captureLogger } from '../../helpers/logs.js';

/** Pasada controlada por la prueba: termina cuando la prueba llama a `finish`. */
function controllable() {
  const finishes: (() => void)[] = [];
  const fails: ((error: Error) => void)[] = [];
  const run = vi.fn(
    () =>
      new Promise<void>((resolve, reject) => {
        finishes.push(resolve);
        fails.push(reject);
      }),
  );
  return {
    run,
    finish: (index: number) => finishes[index]?.(),
    fail: (index: number, error: Error) => fails[index]?.(error),
  };
}

const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('TRF-30 ejecutor periódico en el arranque', () => {
  it('TRF-30 corre una pasada al arrancar y luego una por intervalo', async () => {
    const run = vi.fn(async () => undefined);
    const task = new PeriodicTask({
      name: 'prueba',
      intervalMs: 1_000,
      run,
      logger: captureLogger().logger,
    });
    task.start();
    await flush();
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(run).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(run).toHaveBeenCalledTimes(3);
    await task.stop();
  });

  it('TRF-30 una pasada a la vez: mientras una sigue en curso, las siguientes se omiten', async () => {
    const pass = controllable();
    const task = new PeriodicTask({
      name: 'prueba',
      intervalMs: 1_000,
      run: pass.run,
      logger: captureLogger().logger,
    });
    task.start();
    await vi.advanceTimersByTimeAsync(3_500);
    expect(pass.run).toHaveBeenCalledTimes(1);
    pass.finish(0);
    await flush();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(pass.run).toHaveBeenCalledTimes(2);
    pass.finish(1);
    await task.stop();
  });

  it('TRF-30 stop detiene el intervalo y espera la pasada en curso antes de resolver', async () => {
    const pass = controllable();
    const task = new PeriodicTask({
      name: 'prueba',
      intervalMs: 1_000,
      run: pass.run,
      logger: captureLogger().logger,
    });
    task.start();
    await flush();
    let stopped = false;
    const stopping = task.stop().then(() => {
      stopped = true;
    });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(stopped).toBe(false);
    expect(pass.run).toHaveBeenCalledTimes(1);
    pass.finish(0);
    await stopping;
    expect(stopped).toBe(true);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(pass.run).toHaveBeenCalledTimes(1);
  });

  it('TRF-36 una pasada que falla se registra como ERROR y la siguiente corre', async () => {
    const logs = captureLogger();
    const pass = controllable();
    const task = new PeriodicTask({
      name: 'prueba',
      intervalMs: 1_000,
      run: pass.run,
      logger: logs.logger,
    });
    task.start();
    await flush();
    pass.fail(0, new Error('base caída'));
    await flush();
    expect(logs.entries()).toEqual([
      expect.objectContaining({ level: 'error', task: 'prueba', msg: 'periodic task failed' }),
    ]);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(pass.run).toHaveBeenCalledTimes(2);
    pass.finish(1);
    await task.stop();
  });
});
