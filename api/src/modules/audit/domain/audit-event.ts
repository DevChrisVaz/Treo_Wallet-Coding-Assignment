/**
 * Catálogo cerrado de eventos auditados (AUD-01). La base de datos lo replica en
 * `ck_audit_log_action`; una prueba verifica que ambos coincidan.
 */
export const AUDIT_ACTIONS = [
  // Identidad
  'USER_REGISTERED',
  'EMAIL_VERIFIED',
  'EMAIL_VERIFICATION_RESENT',
  'LOGIN_SUCCEEDED',
  'LOGIN_FAILED',
  'LOGOUT',
  // Seguridad
  'REFRESH_TOKEN_REUSE_DETECTED',
  'OTP_ATTEMPT_FAILED',
  'OTP_ATTEMPTS_EXHAUSTED',
  // Beneficiarios
  'BENEFICIARY_CREATED',
  // Transferencias
  'TRANSFER_CREATED',
  'TRANSFER_OTP_SENT',
  'TRANSFER_OTP_RESENT',
  'TRANSFER_COMPLETED',
  'TRANSFER_REJECTED',
  'TRANSFER_FAILED',
  // Sistema
  'FUNDING_POSTED',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const ACTOR_TYPES = ['USER', 'SYSTEM', 'ANONYMOUS'] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

/** Valor admitido en los metadatos: ids, montos, estados, motivos y propósitos (AUD-02). */
export type AuditMetadataValue = string | number | boolean | null;

/** Evento de la bitácora. El momento, el `requestId`, la IP y el user agent los agrega el escritor. */
export interface AuditEvent {
  readonly action: AuditAction;
  readonly actor:
    | { readonly type: 'USER'; readonly userId: string }
    | { readonly type: 'SYSTEM' }
    | { readonly type: 'ANONYMOUS' };
  readonly entity?: { readonly type: string; readonly id: string };
  readonly metadata?: Readonly<Record<string, AuditMetadataValue>>;
}

export function isAuditAction(value: string): value is AuditAction {
  return (AUDIT_ACTIONS as readonly string[]).includes(value);
}
