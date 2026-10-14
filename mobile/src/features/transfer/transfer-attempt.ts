/**
 * Intento de transferencia (diseño, decisión 5): máquina de estados en TypeScript puro, sin React,
 * que guarda la `Idempotency-Key`, el payload congelado y la política de reintentos. Se prueba con
 * temporizadores falsos sin renderizar pantallas.
 *
 * - Llave (MOB-09): una por intento, generada al pasar a revisión; editar la descarta.
 * - Payload congelado: el cuerpo se serializa una vez; todos los envíos del intento mandan los
 *   mismos bytes, así la API calcula el mismo fingerprint.
 * - Doble toque: `submit` solo actúa desde revisión; durante el envío se ignora.
 * - Reintentos (MOB-10): sin respuesta (red o tiempo de espera) o `5xx`, con espera de 1, 2, 4, 8
 *   y 16 s (±20 %) y máximo 5 reintentos, siempre con la misma llave y el mismo payload. Los `4xx`
 *   son definitivos; un `429` espera el reintento manual (la petición no llegó a ejecutarse).
 */
import {
  createIdempotencyKey,
  NetworkError,
  ProblemError,
  transferForm,
  type OtpChallenge,
  type Transfer,
} from '@devchrisvaz/wallet-contract';
import { randomUUID } from 'expo-crypto';

import { zodFieldErrors } from '@/lib/field-errors';

export interface TransferDraft {
  fromAccountId: string;
  beneficiaryId: string;
  amount: string;
  concept: string;
  reference: string;
}

export interface CreateResult {
  transfer: Transfer;
  /** `Idempotent-Replayed: true`: la API reconoció un reintento con la misma llave. */
  replayed: boolean;
}

/** Llamadas a la API; lanzan `ProblemError` (respuesta) o `NetworkError` (sin respuesta). */
export interface TransferTransport {
  create(key: string, payload: string): Promise<CreateResult>;
  confirm(transferId: string, otp: string): Promise<Transfer>;
  resend(transferId: string): Promise<OtpChallenge>;
}

/** Cambios de conectividad (NetInfo). El primer aviso trae el estado actual. */
export interface Connectivity {
  subscribe(listener: (connected: boolean) => void): () => void;
}

interface Frozen {
  key: string;
  payload: string;
  draft: TransferDraft;
}

export type AttemptState =
  | { status: 'editing' }
  | ({ status: 'reviewing' } & Frozen)
  | ({ status: 'sending'; retries: number } & Frozen)
  | ({ status: 'waitingRetry'; retry: number; delayMs: number } & Frozen)
  | ({ status: 'rateLimited'; retryAfterSeconds: number | undefined } & Frozen)
  | ({ status: 'uncertain' } & Frozen)
  | { status: 'completed'; transfer: Transfer; replayed: boolean }
  | {
      status: 'pendingOtp';
      transfer: Transfer;
      /** Error de la última confirmación (código incorrecto, 429...). */
      otpError?: ProblemError | undefined;
      resending?: boolean;
      /** Error del último reenvío (por ejemplo, `RESEND_LIMIT_REACHED`). */
      resendError?: unknown;
    }
  | { status: 'confirmingOtp'; transfer: Transfer; code: string; retries: number }
  | { status: 'waitingOtpRetry'; transfer: Transfer; code: string; retry: number; delayMs: number }
  | { status: 'otpUncertain'; transfer: Transfer; code: string }
  | { status: 'failed'; transfer: Transfer; error: ProblemError }
  | { status: 'expired'; transfer: Transfer; error: ProblemError }
  | ({ status: 'rejected'; error: ProblemError } & Frozen)
  | ({ status: 'error'; error: ProblemError } & Frozen);

export type ReviewResult = { ok: true } | { ok: false; errors: Record<string, string> };

export interface TransferAttemptOptions {
  transport: TransferTransport;
  connectivity: Connectivity;
  /** Generador de la llave; por defecto, UUID v4 de expo-crypto (Hermes no tiene crypto.randomUUID). */
  generateKey?: () => string;
  /** Fuente de la variación de la espera; por defecto, `Math.random`. */
  random?: () => number;
}

export const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;
const JITTER = 0.2;

/** Espera antes del reintento `retry` (1 a 5): 1, 2, 4, 8 o 16 s, con ±20 % de variación. */
export function retryDelay(retry: number, random: () => number = Math.random): number {
  const base = BASE_DELAY_MS * 2 ** (retry - 1);
  return Math.round(base * (1 - JITTER + 2 * JITTER * random()));
}

/** Rechazos de negocio al crear: la transferencia queda `REJECTED` y se puede corregir. */
const REJECTION_CODES = new Set(['INSUFFICIENT_FUNDS', 'DAILY_LIMIT_EXCEEDED']);

/** Fallas definitivas al confirmar: la transferencia queda `FAILED`. */
const CONFIRM_FAILURE_CODES = new Set([
  'OTP_ATTEMPTS_EXHAUSTED',
  'INSUFFICIENT_FUNDS',
  'DAILY_LIMIT_EXCEEDED',
]);

export function isRetryable(error: unknown): boolean {
  if (error instanceof NetworkError) return true;
  return error instanceof ProblemError && error.status >= 500;
}

export function freezePayload(draft: TransferDraft): string {
  return JSON.stringify({
    fromAccountId: draft.fromAccountId,
    destination: { type: 'BENEFICIARY', beneficiaryId: draft.beneficiaryId },
    amount: draft.amount,
    concept: draft.concept,
    reference: draft.reference,
  });
}

export class TransferAttempt {
  private state: AttemptState = { status: 'editing' };
  private readonly listeners = new Set<() => void>();
  private readonly transport: TransferTransport;
  private readonly generateKey: () => string;
  private readonly random: () => number;
  private readonly connectivity: Connectivity;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopListening: (() => void) | undefined;

  constructor(options: TransferAttemptOptions) {
    this.transport = options.transport;
    this.connectivity = options.connectivity;
    this.generateKey = options.generateKey ?? (() => createIdempotencyKey(randomUUID));
    this.random = options.random ?? Math.random;
  }

  /** Cancela el reintento pendiente y deja de escuchar la red (la pantalla se cerró). */
  dispose(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.stopListening?.();
    this.stopListening = undefined;
  }

  /**
   * Ejecuta `run` al vencer la espera o, antes, en cuanto la red vuelve (MOB-10): solo cuenta el
   * paso de sin conexión a con conexión, no el aviso inicial de NetInfo con el estado actual.
   */
  private waitThenRun(delayMs: number, run: () => void): void {
    this.dispose();
    this.timer = setTimeout(() => {
      this.dispose();
      run();
    }, delayMs);
    let wasConnected: boolean | undefined;
    this.stopListening = this.connectivity.subscribe((connected) => {
      const recovered = connected && wasConnected === false;
      wasConnected = connected;
      if (!recovered) return;
      this.dispose();
      run();
    });
  }

  getState = (): AttemptState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Valida con el esquema del contrato y, si es válido, abre un intento con su llave. */
  review(draft: TransferDraft): ReviewResult {
    if (this.state.status !== 'editing') return { ok: true };
    const parsed = transferForm.safeParse(JSON.parse(freezePayload(draft)));
    if (!parsed.success) return { ok: false, errors: zodFieldErrors(parsed.error) };
    const key = this.generateKey();
    // Sin llave, openapi-fetch omitiría el header en silencio y la API no podría deduplicar.
    if (typeof key !== 'string' || key === '') {
      throw new Error('No se pudo generar la Idempotency-Key del intento');
    }
    this.setState({
      status: 'reviewing',
      key,
      payload: freezePayload(draft),
      draft,
    });
    return { ok: true };
  }

  /** Vuelve a la captura: el siguiente envío será otro intento, con otra llave. */
  edit(): void {
    const { status } = this.state;
    if (status === 'reviewing' || status === 'rejected' || status === 'error') {
      this.setState({ status: 'editing' });
    }
  }

  /** Envía el intento. Solo actúa desde revisión: un segundo toque durante el envío se ignora. */
  async submit(): Promise<void> {
    const current = this.state;
    if (current.status !== 'reviewing') return;
    await this.send(frozenOf(current), 0);
  }

  /**
   * Reintento manual (MOB-11): desde el estado incierto (la transferencia pudo haberse creado) o
   * tras un `429`, con la misma llave y el mismo payload; desde la confirmación incierta, con el
   * mismo código. Vuelve a aplicar la política automática.
   */
  async retry(): Promise<void> {
    const current = this.state;
    if (current.status === 'otpUncertain') {
      await this.sendConfirmation(current.transfer, current.code, 0);
      return;
    }
    if (current.status !== 'uncertain' && current.status !== 'rateLimited') return;
    await this.send(frozenOf(current), 0);
  }

  /**
   * Confirma con el código de 6 dígitos (MOB-12). La API la trata como idempotente por estado, así
   * que se reintenta igual que la creación, con el mismo código.
   */
  async confirmOtp(code: string): Promise<void> {
    const current = this.state;
    if (current.status !== 'pendingOtp' || current.resending) return;
    await this.sendConfirmation(current.transfer, code, 0);
  }

  /** Reenvía el código; el reto nuevo reinicia los intentos y el vencimiento. */
  async resendOtp(): Promise<void> {
    const current = this.state;
    if (current.status !== 'pendingOtp' || current.resending) return;
    const { transfer } = current;
    this.setState({ status: 'pendingOtp', transfer, resending: true });
    try {
      const otp = await this.transport.resend(transfer.id);
      this.setState({ status: 'pendingOtp', transfer: { ...transfer, otp } });
    } catch (error) {
      if (error instanceof ProblemError && error.code === 'TRANSFER_EXPIRED') {
        this.setState({ status: 'expired', transfer, error });
        return;
      }
      const exhausted = error instanceof ProblemError && error.code === 'RESEND_LIMIT_REACHED';
      const otp =
        transfer.otp && exhausted ? { ...transfer.otp, resendsRemaining: 0 } : transfer.otp;
      this.setState({ status: 'pendingOtp', transfer: { ...transfer, otp }, resendError: error });
    }
  }

  /** Tras una falla o un vencimiento, vuelve a la captura para un intento nuevo (llave nueva). */
  restart(): void {
    if (this.state.status === 'failed' || this.state.status === 'expired') {
      this.setState({ status: 'editing' });
    }
  }

  private async sendConfirmation(transfer: Transfer, code: string, retries: number): Promise<void> {
    this.dispose();
    this.setState({ status: 'confirmingOtp', transfer, code, retries });
    try {
      this.settle(await this.transport.confirm(transfer.id, code), false);
    } catch (error) {
      this.failConfirmation(transfer, code, error, retries);
    }
  }

  private failConfirmation(transfer: Transfer, code: string, error: unknown, retries: number) {
    if (isRetryable(error) && retries < MAX_RETRIES) {
      const retry = retries + 1;
      const delayMs = retryDelay(retry, this.random);
      this.setState({ status: 'waitingOtpRetry', transfer, code, retry, delayMs });
      this.waitThenRun(delayMs, () => void this.sendConfirmation(transfer, code, retry));
    } else if (isRetryable(error) || !(error instanceof ProblemError)) {
      this.setState({ status: 'otpUncertain', transfer, code });
    } else if (error.code === 'OTP_INVALID') {
      const otp = transfer.otp && {
        ...transfer.otp,
        attemptsRemaining: error.attemptsRemaining ?? 0,
      };
      this.setState({ status: 'pendingOtp', transfer: { ...transfer, otp }, otpError: error });
    } else if (CONFIRM_FAILURE_CODES.has(error.code)) {
      this.setState({ status: 'failed', transfer, error });
    } else if (
      error.code === 'TRANSFER_EXPIRED' ||
      (error.code === 'TRANSFER_NOT_PENDING' && error.transferStatus === 'EXPIRED')
    ) {
      this.setState({ status: 'expired', transfer, error });
    } else if (error.code === 'TRANSFER_NOT_PENDING') {
      this.setState({ status: 'failed', transfer, error });
    } else {
      this.setState({ status: 'pendingOtp', transfer, otpError: error });
    }
  }

  private async send(frozen: Frozen, retries: number): Promise<void> {
    this.dispose();
    this.setState({ status: 'sending', retries, ...frozen });
    try {
      const { transfer, replayed } = await this.transport.create(frozen.key, frozen.payload);
      this.settle(transfer, replayed);
    } catch (error) {
      this.fail(frozen, error, retries);
    }
  }

  private scheduleRetry(frozen: Frozen, retries: number): void {
    const retry = retries + 1;
    const delayMs = retryDelay(retry, this.random);
    this.setState({ status: 'waitingRetry', retry, delayMs, ...frozen });
    this.waitThenRun(delayMs, () => void this.send(frozen, retry));
  }

  private settle(transfer: Transfer, replayed: boolean): void {
    if (transfer.status === 'PENDING_OTP') {
      this.setState({ status: 'pendingOtp', transfer });
    } else {
      this.setState({ status: 'completed', transfer, replayed });
    }
  }

  private fail(frozen: Frozen, error: unknown, retries: number): void {
    if (isRetryable(error) && retries < MAX_RETRIES) {
      this.scheduleRetry(frozen, retries);
    } else if (isRetryable(error) || !(error instanceof ProblemError)) {
      this.setState({ status: 'uncertain', ...frozen });
    } else if (error.status === 429) {
      this.setState({
        status: 'rateLimited',
        retryAfterSeconds: error.retryAfter,
        ...frozen,
      });
    } else if (REJECTION_CODES.has(error.code)) {
      this.setState({ status: 'rejected', error, ...frozen });
    } else {
      this.setState({ status: 'error', error, ...frozen });
    }
  }

  private setState(state: AttemptState): void {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
}

function frozenOf(state: Frozen): Frozen {
  return { key: state.key, payload: state.payload, draft: state.draft };
}
