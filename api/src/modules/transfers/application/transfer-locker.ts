import { businessDayOf } from '../../../shared/business-day.js';
import type { Clock } from '../../../shared/clock.js';
import type { Money } from '../../../shared/money.js';
import type { Transaction } from '../../../shared/transaction.js';
import type { LockedAccount } from '../domain/ledger.js';
import { notFound, type ResolvedRoute } from './destination-resolver.js';
import type { AccountLocks } from './ports.js';

/** Fila contador del límite diario, bloqueada (`SELECT … FOR UPDATE`). */
export interface DailyUsageCounter {
  /** Crea la fila del día si no existe (con el límite vigente) y la bloquea. */
  lock(
    tx: Transaction,
    userId: string,
    day: string,
    limit: Money,
  ): Promise<{ used: Money; limit: Money }>;
  add(tx: Transaction, userId: string, day: string, amount: Money): Promise<void>;
}

/** La medianoche de CDMX llegó mientras se esperaban los bloqueos: hay que reintentar. */
export class DayChangedWhileWaiting extends Error {
  constructor() {
    super('El día de negocio cambió mientras se esperaban los bloqueos');
    this.name = 'DayChangedWhileWaiting';
  }
}

export interface AcquiredLocks {
  /** Día de CDMX de la operación (el de la fila contador). */
  readonly day: string;
  /** Hora tomada después de obtener todos los bloqueos: `completed_at` y fecha de los asientos. */
  readonly at: Date;
  readonly counter: { readonly used: Money; readonly limit: Money } | null;
  readonly from: LockedAccount;
  readonly to: LockedAccount;
}

/**
 * Bloqueos de una transferencia en el orden global del diseño (TRF-06, TRF-12, TRF-13, TRF-24):
 * 1. fila contador del usuario y del día de CDMX (solo THIRD_PARTY);
 * 2. cuentas en orden de id con `FOR NO KEY UPDATE`, verificando la propiedad en la misma sentencia;
 * 3. hora después de los bloqueos: si ya es otro día de CDMX, `DayChangedWhileWaiting` (quien llama
 *    revierte y reintenta una vez).
 * La confirmación bloquea la fila de la transferencia (y su código) entre el paso 1 y el 2, por eso
 * los pasos también se exponen por separado. Ningún ciclo de espera es posible: a lo más una fila
 * contador, siempre antes que la transferencia, y la transferencia siempre antes que las cuentas.
 */
export class TransferLocker {
  constructor(
    private readonly counter: DailyUsageCounter,
    private readonly locks: AccountLocks,
    private readonly clock: Clock,
    private readonly dailyLimit: Money,
  ) {}

  async acquire(tx: Transaction, userId: string, route: ResolvedRoute): Promise<AcquiredLocks> {
    const { day, counter } = await this.lockCounter(tx, userId, route.kind);
    return { day, counter, ...(await this.lockAccounts(tx, userId, route, day, counter !== null)) };
  }

  /** Paso 1: fila contador del día de CDMX de ahora (solo THIRD_PARTY). */
  async lockCounter(
    tx: Transaction,
    userId: string,
    kind: ResolvedRoute['kind'],
  ): Promise<Pick<AcquiredLocks, 'day' | 'counter'>> {
    const day = businessDayOf(this.clock.now());
    const counter =
      kind === 'THIRD_PARTY' ? await this.counter.lock(tx, userId, day, this.dailyLimit) : null;
    return { day, counter };
  }

  /**
   * Paso 2 y 3: cuentas en orden de id con su propiedad y hora después de los bloqueos. Si se tiene
   * la fila contador y la hora ya es de otro día de CDMX, lanza `DayChangedWhileWaiting`.
   */
  async lockAccounts(
    tx: Transaction,
    userId: string,
    route: ResolvedRoute,
    day: string,
    holdsCounter: boolean,
  ): Promise<Pick<AcquiredLocks, 'at' | 'from' | 'to'>> {
    const ownedIds =
      route.kind === 'OWN' ? [route.fromAccountId, route.toAccountId] : [route.fromAccountId];
    const locked = await this.locks.lock(tx, [route.fromAccountId, route.toAccountId], {
      ownedBy: userId,
      ownedIds,
    });
    const from = locked.find((account) => account.id === route.fromAccountId);
    const to = locked.find((account) => account.id === route.toAccountId);
    if (!from || !to) throw notFound();
    const at = this.clock.now();
    if (holdsCounter && businessDayOf(at) !== day) throw new DayChangedWhileWaiting();
    return { at, from, to };
  }
}
