import type { FieldError, ProblemCode, TransferStatus } from '@devchrisvaz/wallet-contract';

export type { FieldError, FieldErrorCode, ProblemCode } from '@devchrisvaz/wallet-contract';

/** Extensiones de RFC 9457 que define el contrato; cada una solo aplica a ciertos códigos. */
export interface ProblemExtensions {
  readonly errors?: readonly FieldError[];
  readonly transferId?: string;
  readonly transferStatus?: TransferStatus;
  readonly remaining?: string;
  readonly attemptsRemaining?: number;
}

/**
 * Error de negocio con un `code` del catálogo cerrado del contrato. Lo lanzan el dominio y los
 * casos de uso; la capa HTTP lo convierte en problem+json (PLT-01).
 */
export class DomainError extends Error {
  constructor(
    readonly code: ProblemCode,
    readonly detail?: string,
    readonly extensions: ProblemExtensions = {},
  ) {
    super(detail ?? code);
    this.name = 'DomainError';
  }
}
