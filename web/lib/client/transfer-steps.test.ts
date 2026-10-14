import { describe, expect, it } from 'vitest';
import {
  BENEFICIARY,
  OVERVIEW,
  PRINCIPAL,
  pendingOtpTransfer,
  problem,
  transfer,
} from '@/test/fixtures';
import type { TransferDraft, TransferFlowState } from './transfer-flow';
import { OTP_NOTICE, flowHeading, requiresOtp, transferSummary } from './transfer-steps';

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
});
