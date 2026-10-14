import { draft, transfer } from '@/test-utils/transfer-fixtures';

import { RECIPIENT_HEADING, flowHeading, requiresOtp } from '../flow-steps';
import type { AttemptState } from '../transfer-attempt';

const frozen = (amount: string) => ({ key: 'k', payload: '{}', draft: { ...draft, amount } });

describe('pasos del flujo', () => {
  test('MOB-21 destinatario y monto son los pasos 1 y 2 de 5', () => {
    expect(RECIPIENT_HEADING).toEqual({
      title: '¿A quién le envías?',
      step: 1,
      total: 5,
      label: 'Destinatario',
    });
    expect(flowHeading({ status: 'editing' })).toEqual({
      title: '¿Cuánto envías?',
      step: 2,
      total: 5,
      label: 'Monto',
    });
  });

  test('MOB-21 la revisión es el paso 3 de 5 con código y 3 de 4 sin él (R36)', () => {
    expect(flowHeading({ status: 'reviewing', ...frozen('15000') })).toEqual({
      title: 'Revisa tu transferencia',
      step: 3,
      total: 5,
      label: 'Revisión',
    });
    expect(
      flowHeading({ status: 'waitingRetry', retry: 1, delayMs: 1000, ...frozen('1250') }),
    ).toEqual({ title: 'Enviando tu transferencia', step: 3, total: 4, label: 'Revisión' });
    expect(requiresOtp('10000.00')).toBe(false);
  });

  test('MOB-21 el código es el paso 4 de 5 y el comprobante el último', () => {
    const pending = transfer({ status: 'PENDING_OTP', requiresOtp: true });
    expect(flowHeading({ status: 'pendingOtp', transfer: pending })).toEqual({
      title: 'Confirma con tu código',
      step: 4,
      total: 5,
      label: 'Código',
    });
    expect(
      flowHeading({ status: 'completed', transfer: transfer(), replayed: false } as AttemptState),
    ).toMatchObject({ step: 4, total: 4, label: 'Comprobante' });
    expect(
      flowHeading({
        status: 'completed',
        transfer: transfer({ requiresOtp: true }),
        replayed: false,
      }),
    ).toMatchObject({ step: 5, total: 5 });
  });
});
