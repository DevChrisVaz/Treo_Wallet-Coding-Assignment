import { describe, expect, it } from 'vitest';
import {
  AHORRO,
  BENEFICIARY,
  OVERVIEW,
  PRINCIPAL,
  pendingOtpTransfer,
  problem,
  transfer,
} from '@/test/fixtures';
import type { TransferDraft, TransferFlowState } from './transfer-flow';
import {
  OTP_NOTICE,
  flowHeading,
  receiptTitle,
  requiresOtp,
  transferSummary,
} from './transfer-steps';

function draft(amount: string): TransferDraft {
  return {
    values: {
      fromAccountId: PRINCIPAL.id,
      destinationType: 'BENEFICIARY',
      toAccountId: '',
      beneficiaryId: BENEFICIARY.id,
      amount,
      concept: 'Renta',
      reference: '1',
      when: 'NOW',
      scheduledFor: '',
      scheduledTime: '',
    },
    request: {
      fromAccountId: PRINCIPAL.id,
      destination: { type: 'BENEFICIARY', beneficiaryId: BENEFICIARY.id },
      amount,
      concept: 'Renta',
      reference: '1',
    },
  };
}
const confirm = (
  amount: string,
  status: 'idle' | 'uncertain' | 'rejected' = 'idle',
): TransferFlowState => ({ step: 'confirm', draft: draft(amount), status });
const CTX = {
  accounts: OVERVIEW.accounts,
  beneficiaries: [BENEFICIARY],
  live: null,
  originId: PRINCIPAL.id,
  remaining: '38000.00',
};

describe('pasos del flujo', () => {
  it('WEB-30 un monto mayor a $10,000.00 pide código; exactamente $10,000.00 no', () => {
    expect(requiresOtp('10000.00')).toBe(false);
    expect(requiresOtp('10000.01')).toBe(true);
  });

  it('WEB-30 destinatario y monto son los pasos 1 y 2 de 5', () => {
    expect(flowHeading({ step: 'recipient', draft: null })).toEqual({
      title: '¿A quién le envías?',
      step: 1,
      total: 5,
      label: 'Destinatario',
    });
    expect(
      flowHeading({
        step: 'form',
        draft: null,
        recipient: { destinationType: 'BENEFICIARY', beneficiaryId: BENEFICIARY.id },
      }),
    ).toEqual({ title: '¿Cuánto envías?', step: 2, total: 5, label: 'Monto' });
  });

  it('WEB-30 la revisión es el paso 3 de 5 con código y 3 de 4 sin él (R36)', () => {
    expect(flowHeading(confirm('15000'))).toEqual({
      title: 'Revisa tu transferencia',
      step: 3,
      total: 5,
      label: 'Revisión',
    });
    expect(flowHeading(confirm('5000'))).toMatchObject({ step: 3, total: 4 });
    expect(flowHeading(confirm('5000', 'uncertain')).title).toBe('Estado sin confirmar');
    expect(flowHeading(confirm('30000', 'rejected'))).toMatchObject({
      title: 'Transferencia rechazada',
      total: 5,
    });
  });

  it('WEB-30 el código es el paso 4 de 5 y el comprobante es el último paso', () => {
    expect(flowHeading({ step: 'otp', transfer: pendingOtpTransfer(), replayed: false })).toEqual({
      title: 'Confirma con tu código',
      step: 4,
      total: 5,
      label: 'Código',
    });
    expect(flowHeading({ step: 'receipt', transfer: transfer(), replayed: false })).toEqual({
      title: 'Transferencia enviada',
      step: 4,
      total: 4,
      label: 'Comprobante',
    });
    expect(
      flowHeading({ step: 'ended', problem: problem('OTP_ATTEMPTS_EXHAUSTED'), transfer: null }),
    ).toEqual({ title: 'La transferencia no se realizó', step: 5, total: 5, label: 'Comprobante' });
    expect(
      flowHeading({ step: 'ended', problem: problem('TRANSFER_EXPIRED'), transfer: null }).title,
    ).toBe('El código venció');
  });

  it('WEB-30 el resumen dice lo capturado y, si pedirá código, lo avisa', () => {
    expect(transferSummary({ step: 'recipient', draft: null }, CTX)).toEqual({
      rows: { desde: 'Principal · •••• 9719' },
      note: 'Te quedan $38,000.00 de tu límite diario de hoy.',
    });
    expect(transferSummary(confirm('15000'), CTX)).toEqual({
      rows: {
        desde: 'Principal · •••• 9719',
        para: 'Luis · •••• 9735',
        monto: '$15,000.00',
        concepto: 'Renta',
        referencia: '1',
      },
      note: OTP_NOTICE,
    });
  });

  it('WEB-16 si el destino es la cuenta de origen por omisión, el resumen toma la otra como origen (R38)', () => {
    const toPrincipal: TransferFlowState = {
      step: 'form',
      draft: null,
      recipient: { destinationType: 'OWN_ACCOUNT', toAccountId: PRINCIPAL.id },
    };
    expect(transferSummary(toPrincipal, CTX).rows).toMatchObject({
      desde: 'Ahorro · •••• 9722',
      para: 'Principal · •••• 9719',
    });
    const cleared = {
      ...draft('').values,
      fromAccountId: '',
      destinationType: 'OWN_ACCOUNT' as const,
      toAccountId: PRINCIPAL.id,
      beneficiaryId: '',
    };
    expect(transferSummary(toPrincipal, { ...CTX, live: cleared }).rows.desde).toBeUndefined();
    expect(
      transferSummary(toPrincipal, { ...CTX, live: { ...cleared, fromAccountId: AHORRO.id } }).rows
        .desde,
    ).toBe('Ahorro · •••• 9722');
  });

  it('WEB-33 el comprobante de una programada se titula "Transferencia programada", también tras el código', () => {
    const scheduled = transfer({
      status: 'SCHEDULED',
      scheduledFor: '2026-10-20T20:30:00.000Z',
      completedAt: null,
    });
    expect(receiptTitle(scheduled)).toBe('Transferencia programada');
    expect(flowHeading({ step: 'receipt', transfer: scheduled, replayed: false })).toEqual({
      title: 'Transferencia programada',
      step: 4,
      total: 4,
      label: 'Comprobante',
    });
    expect(
      flowHeading({
        step: 'receipt',
        transfer: { ...scheduled, amount: '15000.00', requiresOtp: true },
        replayed: false,
      }),
    ).toMatchObject({ title: 'Transferencia programada', step: 5, total: 5 });
    expect(receiptTitle(transfer({ status: 'CANCELLED' }))).toBe('Estado de la transferencia');
  });

  it('WEB-33 el resumen dice cuándo se enviará solo si es programada y la fecha ya es válida', () => {
    const toLuis: TransferFlowState = {
      step: 'form',
      draft: null,
      recipient: { destinationType: 'BENEFICIARY', beneficiaryId: BENEFICIARY.id },
    };
    const values = draft('1000').values;
    const live = (when: 'NOW' | 'SCHEDULED', scheduledFor: string, scheduledTime = '14:30') => ({
      ...CTX,
      live: { ...values, when, scheduledFor, scheduledTime },
    });
    expect(transferSummary(toLuis, live('SCHEDULED', '2026-10-20')).rows.programada).toBe(
      '2026-10-20T20:30:00.000Z',
    );
    // "Ahora" no envía fecha aunque se haya escrito una; una fecha incompleta aún no se resume.
    expect(transferSummary(toLuis, live('NOW', '2026-10-20')).rows).not.toHaveProperty(
      'programada',
    );
    expect(transferSummary(toLuis, live('SCHEDULED', '2026-10-20', '')).rows).not.toHaveProperty(
      'programada',
    );
    expect(transferSummary(toLuis, live('SCHEDULED', '2026-10')).rows).not.toHaveProperty(
      'programada',
    );

    const scheduledDraft = draft('1000');
    scheduledDraft.request = {
      ...scheduledDraft.request,
      scheduledFor: '2026-10-20T20:30:00.000Z',
    };
    expect(
      transferSummary({ step: 'confirm', draft: scheduledDraft, status: 'idle' }, CTX).rows
        .programada,
    ).toBe('2026-10-20T20:30:00.000Z');
    expect(transferSummary(confirm('1000'), CTX).rows).not.toHaveProperty('programada');

    const scheduled = transfer({
      status: 'SCHEDULED',
      scheduledFor: '2026-10-20T20:30:00.000Z',
      completedAt: null,
    });
    expect(
      transferSummary({ step: 'receipt', transfer: scheduled, replayed: false }, CTX).rows
        .programada,
    ).toBe('2026-10-20T20:30:00.000Z');
    expect(
      transferSummary({ step: 'receipt', transfer: transfer(), replayed: false }, CTX).rows,
    ).not.toHaveProperty('programada');
  });

  it('WEB-18 si la API da el estado real de una transferencia que ya no está pendiente, el título lo sigue', () => {
    const notPending = (transferStatus: 'EXPIRED' | 'REJECTED' | 'COMPLETED') =>
      flowHeading({
        step: 'ended',
        problem: problem('TRANSFER_NOT_PENDING', { status: 409, transferStatus }),
        transfer: null,
      }).title;
    expect(notPending('EXPIRED')).toBe('El código venció');
    expect(notPending('REJECTED')).toBe('La transferencia no se realizó');
    expect(notPending('COMPLETED')).toBe('Estado de la transferencia');
  });
});
