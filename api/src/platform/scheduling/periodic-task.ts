import type { AppLogger } from '../../shared/logger.js';

export interface PeriodicTaskOptions {
  /** Nombre para los logs. */
  readonly name: string;
  readonly intervalMs: number;
  /** Una pasada del trabajo; lo que devuelva se ignora. */
  readonly run: () => Promise<unknown>;
  readonly logger: AppLogger;
}

/**
 * Trabajo periódico dentro del proceso (D6 de scheduled-transfers): una pasada al arrancar y luego
 * una cada `intervalMs`, con **una sola pasada a la vez**: si la anterior sigue en curso cuando toca
 * la siguiente, esa se omite (no se encolan). Una pasada que falla se registra como ERROR y no
 * detiene las siguientes. `stop()` detiene el intervalo y espera a que termine la pasada en curso,
 * para que el apagado no cierre el pool a la mitad de una transacción.
 */
export class PeriodicTask {
  private timer: ReturnType<typeof setInterval> | null = null;
  private current: Promise<void> | null = null;
  private stopped = false;

  constructor(private readonly options: PeriodicTaskOptions) {}

  start(): void {
    if (this.timer || this.stopped) return;
    // La primera pasada no espera un intervalo: tras un reinicio, lo atrasado sale de inmediato.
    this.tick();
    this.timer = setInterval(() => this.tick(), this.options.intervalMs);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.current;
  }

  private tick(): void {
    const { name, run, logger } = this.options;
    if (this.stopped) return;
    if (this.current) {
      logger.debug({ task: name }, 'periodic task still running; tick skipped');
      return;
    }
    this.current = run()
      .then(
        () => undefined,
        (error: unknown) => logger.error({ task: name, err: error }, 'periodic task failed'),
      )
      .finally(() => {
        this.current = null;
      });
  }
}
