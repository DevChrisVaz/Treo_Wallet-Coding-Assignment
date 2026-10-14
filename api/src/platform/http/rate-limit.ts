import type { Request, RequestHandler } from 'express';
import {
  ipKeyGenerator,
  rateLimit as expressRateLimit,
  type ClientRateLimitInfo,
  type Options,
  type Store,
} from 'express-rate-limit';
import type { Clock } from '../../shared/clock.js';
import { DomainError } from '../../shared/errors.js';
import { sendProblem } from './error-handler.js';

/**
 * Almacén en memoria de ventana fija que toma la hora del puerto `Clock`, para que las pruebas
 * controlen el tiempo. Cada instancia de la API cuenta por su lado (en AWS: almacén compartido o
 * reglas de WAF, ver la propuesta de despliegue).
 */
export class ClockMemoryStore implements Store {
  private windowMs = 60_000;
  private readonly hits = new Map<string, { totalHits: number; resetTime: Date }>();

  constructor(private readonly clock: Clock) {}

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  get(key: string): ClientRateLimitInfo | undefined {
    const entry = this.hits.get(key);
    if (!entry || entry.resetTime <= this.clock.now()) return undefined;
    return { ...entry };
  }

  increment(key: string): ClientRateLimitInfo {
    const now = this.clock.now();
    this.prune(now);
    const entry = this.hits.get(key);
    if (!entry || entry.resetTime <= now) {
      const fresh = { totalHits: 1, resetTime: new Date(now.getTime() + this.windowMs) };
      this.hits.set(key, fresh);
      return { ...fresh };
    }
    entry.totalHits += 1;
    return { ...entry };
  }

  decrement(key: string): void {
    const entry = this.hits.get(key);
    if (entry && entry.totalHits > 0) entry.totalHits -= 1;
  }

  resetKey(key: string): void {
    this.hits.delete(key);
  }

  resetAll(): void {
    this.hits.clear();
  }

  private prune(now: Date): void {
    if (this.hits.size < 10_000) return;
    for (const [key, entry] of this.hits) if (entry.resetTime <= now) this.hits.delete(key);
  }
}

/** Llave por IP del cliente (PLT-07); en IPv6 agrupa por subred para no regalar llaves. */
export function byIp(req: Request): string {
  return ipKeyGenerator(req.ip ?? 'desconocida');
}

export interface RateLimitOptions {
  /** Nombre del límite, para los logs. */
  readonly name: string;
  readonly windowMs: number;
  readonly limit: number;
  /** Llave del contador: IP, IP + email, usuario autenticado… */
  readonly key: (req: Request) => string;
  readonly clock: Clock;
}

/**
 * Límite de tasa por ventana (PLT-09). Al superarlo responde `429 RATE_LIMITED` con
 * `Retry-After` en segundos. Nunca bloquea una cuenta: solo frena a la llave que excede la tasa.
 */
export function rateLimit(options: RateLimitOptions): RequestHandler {
  return expressRateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    store: new ClockMemoryStore(options.clock),
    keyGenerator: (req) => `${options.name}:${options.key(req)}`,
    standardHeaders: false,
    legacyHeaders: false,
    handler: (req, res) => {
      const resetTime = (req as Request & { rateLimit?: ClientRateLimitInfo }).rateLimit?.resetTime;
      const seconds = resetTime
        ? Math.ceil((resetTime.getTime() - options.clock.now().getTime()) / 1000)
        : Math.ceil(options.windowMs / 1000);
      res.setHeader('Retry-After', String(Math.max(seconds, 1)));
      sendProblem(
        res,
        new DomainError('RATE_LIMITED', 'Demasiados intentos; espera antes de reintentar'),
        req.originalUrl.split('?')[0],
      );
    },
  });
}
