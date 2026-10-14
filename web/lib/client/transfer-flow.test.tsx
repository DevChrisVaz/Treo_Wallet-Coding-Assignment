import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BENEFICIARY, PRINCIPAL, pendingOtpTransfer, problem, transfer } from '@/test/fixtures';
import { useIdempotencyKey, useTransferFlow, type TransferDraft } from './transfer-flow';

const DRAFT: TransferDraft = {
  values: {
    fromAccountId: PRINCIPAL.id,
    destinationType: 'BENEFICIARY',
    toAccountId: '',
    beneficiaryId: BENEFICIARY.id,
    amount: '5,000',
    concept: 'Renta',
    reference: '1',
    when: 'NOW',
    scheduledFor: '',
  },
  request: {
    fromAccountId: PRINCIPAL.id,
    destination: { type: 'BENEFICIARY', beneficiaryId: BENEFICIARY.id },
    amount: '5000',
    concept: 'Renta',
    reference: '1',
  },
};

function keys() {
  let next = 0;
  return () => {
    next += 1;
    return `key-${next}`;
  };
}

describe('useIdempotencyKey', () => {
  it('WEB-17 genera una llave al emitirla y la conserva hasta descartarla', () => {
    const { result } = renderHook(({ generate }) => useIdempotencyKey(generate), {
      initialProps: { generate: keys() },
    });
    expect(result.current.key).toBeNull();
    act(() => void result.current.issue());
    expect(result.current.key).toBe('key-1');
    act(() => result.current.discard());
    expect(result.current.key).toBeNull();
    act(() => void result.current.issue());
    expect(result.current.key).toBe('key-2');
  });

  it('WEB-17 por defecto genera UUID con createIdempotencyKey del contrato', () => {
    const { result } = renderHook(() => useIdempotencyKey());
    act(() => void result.current.issue());
    expect(result.current.key).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('useTransferFlow', () => {
  it('WEB-17 al pasar a la confirmación genera la llave del intento', () => {
    const { result } = renderHook(({ generate }) => useTransferFlow(generate), {
      initialProps: { generate: keys() },
    });
    expect(result.current.state.step).toBe('form');

    act(() => result.current.review(DRAFT));

    expect(result.current.state).toMatchObject({ step: 'confirm', draft: DRAFT, status: 'idle' });
    expect(result.current.key).toBe('key-1');
  });

  it('WEB-17 un fallo de red o 5xx conserva la misma llave para reintentar', () => {
    const { result } = renderHook(({ generate }) => useTransferFlow(generate), {
      initialProps: { generate: keys() },
    });
    act(() => result.current.review(DRAFT));
    act(() => result.current.sending());
    expect(result.current.state).toMatchObject({ step: 'confirm', status: 'sending' });

    act(() => result.current.uncertain(new TypeError('Failed to fetch')));
    expect(result.current.state).toMatchObject({ step: 'confirm', status: 'uncertain' });
    expect(result.current.key).toBe('key-1');

    act(() => result.current.sending());
    expect(result.current.key).toBe('key-1');
  });

  it('WEB-17 editar descarta la llave: el siguiente envío lleva una nueva', () => {
    const { result } = renderHook(({ generate }) => useTransferFlow(generate), {
      initialProps: { generate: keys() },
    });
    act(() => result.current.review(DRAFT));
    act(() => result.current.edit());

    expect(result.current.state).toMatchObject({ step: 'form', draft: DRAFT });
    expect(result.current.key).toBeNull();

    act(() => result.current.review(DRAFT));
    expect(result.current.key).toBe('key-2');
  });

  it('WEB-17 tras un rechazo la llave se descarta y corregir inicia un intento nuevo', () => {
    const { result } = renderHook(({ generate }) => useTransferFlow(generate), {
      initialProps: { generate: keys() },
    });
    act(() => result.current.review(DRAFT));
    act(() => result.current.sending());
    act(() => result.current.rejected(problem('INSUFFICIENT_FUNDS')));

    expect(result.current.state).toMatchObject({
      step: 'confirm',
      status: 'rejected',
      problem: { code: 'INSUFFICIENT_FUNDS' },
    });
    expect(result.current.key).toBeNull();

    act(() => result.current.edit());
    act(() => result.current.review(DRAFT));
    expect(result.current.key).toBe('key-2');
  });

  it('WEB-33 WEB-17 un error de campo de la API vuelve al formulario con el problema y descarta la llave', () => {
    const invalid = problem('VALIDATION_FAILED', {
      errors: [{ pointer: '/scheduledFor', code: 'DATE_OUT_OF_RANGE', message: 'Fuera de rango' }],
    });
    const { result } = renderHook(({ generate }) => useTransferFlow(generate), {
      initialProps: { generate: keys() },
    });
    act(() => result.current.review(DRAFT));
    act(() => result.current.sending());
    act(() => result.current.invalid(invalid));

    expect(result.current.state).toEqual({ step: 'form', draft: DRAFT, problem: invalid });
    expect(result.current.key).toBeNull();
    act(() => result.current.review(DRAFT));
    expect(result.current.key).toBe('key-2');
  });

  it('WEB-16 WEB-17 una respuesta PENDING_OTP lleva al código y descarta la llave', () => {
    const { result } = renderHook(({ generate }) => useTransferFlow(generate), {
      initialProps: { generate: keys() },
    });
    act(() => result.current.review(DRAFT));
    act(() => result.current.sent(pendingOtpTransfer(), false));

    expect(result.current.state).toMatchObject({ step: 'otp', transfer: pendingOtpTransfer() });
    expect(result.current.key).toBeNull();
  });

  it('WEB-16 una respuesta COMPLETED lleva al comprobante; también tras confirmar el código', () => {
    const { result } = renderHook(({ generate }) => useTransferFlow(generate), {
      initialProps: { generate: keys() },
    });
    act(() => result.current.review(DRAFT));
    act(() => result.current.sent(transfer(), true));
    expect(result.current.state).toMatchObject({ step: 'receipt', replayed: true });

    act(() => result.current.restart());
    act(() => result.current.review(DRAFT));
    act(() => result.current.sent(pendingOtpTransfer(), false));
    act(() => result.current.confirmed(transfer()));
    expect(result.current.state).toMatchObject({ step: 'receipt', transfer: transfer() });
  });

  it('WEB-17 un reintento que devuelve un estado final también se muestra en el comprobante', () => {
    const { result } = renderHook(({ generate }) => useTransferFlow(generate), {
      initialProps: { generate: keys() },
    });
    act(() => result.current.review(DRAFT));
    act(() => result.current.sent(transfer({ status: 'EXPIRED' }), true));
    expect(result.current.state).toMatchObject({ step: 'receipt' });
  });

  it('WEB-18 al agotarse el código o vencer, ofrece iniciar una transferencia nueva', () => {
    const { result } = renderHook(({ generate }) => useTransferFlow(generate), {
      initialProps: { generate: keys() },
    });
    act(() => result.current.review(DRAFT));
    act(() => result.current.sent(pendingOtpTransfer(), false));
    act(() => result.current.ended(problem('OTP_ATTEMPTS_EXHAUSTED')));

    expect(result.current.state).toMatchObject({
      step: 'ended',
      problem: { code: 'OTP_ATTEMPTS_EXHAUSTED' },
    });

    act(() => result.current.restart());
    expect(result.current.state).toEqual({ step: 'form', draft: null });
    expect(result.current.key).toBeNull();
  });
});
