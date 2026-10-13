/** Mismo patrón que `AmountInput` del contrato: 0 a 2 decimales, hasta 12 dígitos enteros. */
const AMOUNT = /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,2})?$/;
const TOO_MANY_DECIMALS = /^(0|[1-9][0-9]*)\.[0-9]{3,}$/;
const TOO_LARGE = /^[1-9][0-9]{12,}(\.[0-9]{1,2})?$/;

export type MoneyParseCode = 'INVALID_FORMAT' | 'TOO_MANY_DECIMALS' | 'TOO_LARGE' | 'NOT_POSITIVE';

/** Monto de entrada inválido; `code` pertenece al vocabulario `FieldErrorCode` del contrato. */
export class MoneyParseError extends Error {
  constructor(
    readonly code: MoneyParseCode,
    message: string,
  ) {
    super(message);
    this.name = 'MoneyParseError';
  }
}

/**
 * Dinero en MXN como centavos `bigint` (TRF-08). Nunca pasa por punto flotante: la entrada se
 * convierte manipulando el texto y la salida siempre lleva 2 decimales. Lo inválido se rechaza,
 * nunca se redondea.
 */
export class Money {
  private constructor(readonly cents: bigint) {}

  static readonly ZERO = new Money(0n);

  static fromCents(cents: bigint): Money {
    return new Money(cents);
  }

  /** Monto de entrada: string decimal positivo, sin signo, separadores, exponente ni espacios. */
  static parse(input: string): Money {
    if (TOO_MANY_DECIMALS.test(input)) {
      throw new MoneyParseError('TOO_MANY_DECIMALS', 'El monto admite máximo 2 decimales');
    }
    if (TOO_LARGE.test(input)) {
      throw new MoneyParseError('TOO_LARGE', 'El monto admite máximo 12 dígitos enteros');
    }
    if (!AMOUNT.test(input)) {
      throw new MoneyParseError(
        'INVALID_FORMAT',
        'Escribe el monto sin signos ni separadores, como 1250.50',
      );
    }
    const [integerPart, fraction = ''] = input.split('.') as [string, string?];
    const cents = BigInt(integerPart) * 100n + BigInt(fraction.padEnd(2, '0'));
    if (cents <= 0n) throw new MoneyParseError('NOT_POSITIVE', 'El monto debe ser mayor que 0');
    return new Money(cents);
  }

  /** `"1250.50"`, `"-150.00"`: siempre 2 decimales. */
  toDecimalString(): string {
    const sign = this.cents < 0n ? '-' : '';
    const absolute = this.cents < 0n ? -this.cents : this.cents;
    return `${sign}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, '0')}`;
  }

  plus(other: Money): Money {
    return new Money(this.cents + other.cents);
  }

  minus(other: Money): Money {
    return new Money(this.cents - other.cents);
  }

  negate(): Money {
    return new Money(-this.cents);
  }

  compare(other: Money): -1 | 0 | 1 {
    return this.cents < other.cents ? -1 : this.cents > other.cents ? 1 : 0;
  }

  isGreaterThan(other: Money): boolean {
    return this.cents > other.cents;
  }

  isLessThan(other: Money): boolean {
    return this.cents < other.cents;
  }
}
