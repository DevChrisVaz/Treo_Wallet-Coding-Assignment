/** Lo que el resumen necesita de cada renglón: el monto con signo y el saldo posterior. */
export interface SummaryEntry {
  readonly amountCents: bigint;
  readonly balanceAfterCents: bigint;
}

/** Las cuatro cifras del resumen, en centavos, y el número de renglones (HIS-12). */
export interface ReconciledSummary {
  readonly openingCents: bigint;
  /** Suma de los montos positivos. */
  readonly creditsCents: bigint;
  /** Suma de los montos negativos, en valor absoluto. */
  readonly debitsCents: bigint;
  /** `balanceAfter` del último renglón, o el saldo inicial si no hubo renglones. */
  readonly closingCents: bigint;
  readonly count: number;
}

/**
 * Invariante rota: el resumen no cuadra con el ledger. No es un error de negocio: la respuesta es
 * `500 INTERNAL_ERROR` y las cifras quedan solo en el log, para que un estado de cuenta descuadrado
 * nunca salga de la API.
 */
export class StatementReconciliationError extends Error {
  readonly openingCents: bigint;
  readonly creditsCents: bigint;
  readonly debitsCents: bigint;
  readonly closingCents: bigint;

  constructor(figures: Omit<ReconciledSummary, 'count'>) {
    super('El resumen del estado de cuenta no cuadra con el ledger');
    this.name = 'StatementReconciliationError';
    this.openingCents = figures.openingCents;
    this.creditsCents = figures.creditsCents;
    this.debitsCents = figures.debitsCents;
    this.closingCents = figures.closingCents;
  }
}

/**
 * Resumen del estado de cuenta (D5): acumula abonos y cargos en centavos con `BigInt` mientras
 * pasan los renglones, sin guardarlos, y al cerrar verifica la conciliación:
 * `inicial + abonos − cargos = saldo final`, donde el saldo final es el `balanceAfter` del último
 * renglón (o el inicial si no hubo renglones).
 */
export class StatementSummary {
  private creditsCents = 0n;
  private debitsCents = 0n;
  private lastBalanceCents: bigint | null = null;
  private count = 0;
  private closed = false;

  private constructor(private readonly openingCents: bigint) {}

  /** Empieza con el saldo inicial: el `balanceAfter` del último asiento anterior al periodo. */
  static open(openingCents: bigint): StatementSummary {
    return new StatementSummary(openingCents);
  }

  add(entry: SummaryEntry): void {
    if (this.closed) throw new Error('El resumen ya se cerró');
    if (entry.amountCents > 0n) this.creditsCents += entry.amountCents;
    else this.debitsCents -= entry.amountCents;
    this.lastBalanceCents = entry.balanceAfterCents;
    this.count += 1;
  }

  /** Cierra el resumen; lanza `StatementReconciliationError` si no cuadra. */
  close(): ReconciledSummary {
    this.closed = true;
    const figures = {
      openingCents: this.openingCents,
      creditsCents: this.creditsCents,
      debitsCents: this.debitsCents,
      closingCents: this.lastBalanceCents ?? this.openingCents,
    };
    if (
      figures.openingCents + figures.creditsCents - figures.debitsCents !==
      figures.closingCents
    ) {
      throw new StatementReconciliationError(figures);
    }
    return { ...figures, count: this.count };
  }
}
