import type { AppLogger } from '../../shared/logger.js';
import { deliverAfterCommit } from './deliver.js';
import type { MailMessage, Mailer } from './mailer.js';

/**
 * Envía los avisos y comprobantes (IDN-18, IDN-19, BEN-12, TRF-38) sin que la respuesta espere al
 * servidor de correo (D8 de security-hardening): una caída del SMTP no retrasa el inicio de sesión
 * ni la transferencia. Quien llama lo usa después del COMMIT. Cada envío lleva su propio `catch`,
 * así que una falla solo se registra (con el destinatario enmascarado por el logger) y nunca se
 * convierte en un `unhandledRejection`. `drain()` espera los envíos en vuelo, para las pruebas y
 * para el apagado ordenado.
 */
export class NoticeDispatcher {
  private readonly inFlight = new Set<Promise<void>>();

  constructor(
    private readonly mailer: Mailer,
    private readonly logger: AppLogger,
  ) {}

  /** Envíos que todavía no terminan. */
  get pending(): number {
    return this.inFlight.size;
  }

  send(
    message: MailMessage,
    template: string,
    options: Parameters<typeof deliverAfterCommit>[4] = {},
  ): void {
    const task: Promise<void> = Promise.resolve()
      .then(() => deliverAfterCommit(this.mailer, this.logger, message, template, options))
      .then(() => undefined)
      .catch(() => {
        // `deliverAfterCommit` ya registra las fallas del envío; esto cubre lo que no espera.
        this.logger.error({ template }, 'notice dispatch failed');
      })
      .finally(() => {
        this.inFlight.delete(task);
      });
    this.inFlight.add(task);
  }

  /**
   * Espera los envíos en vuelo hasta `timeoutMs`. Devuelve cuántos quedaron; si quedó alguno, lo
   * registra y sigue: el apagado no depende de un servidor de correo que no contesta.
   */
  async drain(timeoutMs: number): Promise<number> {
    if (this.inFlight.size === 0) return 0;
    let timer: NodeJS.Timeout | undefined;
    const expired = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, timeoutMs);
    });
    try {
      await Promise.race([Promise.allSettled([...this.inFlight]), expired]);
    } finally {
      clearTimeout(timer);
    }
    const left = this.inFlight.size;
    if (left > 0) this.logger.warn({ pending: left, timeoutMs }, 'notices pending at drain');
    return left;
  }
}
