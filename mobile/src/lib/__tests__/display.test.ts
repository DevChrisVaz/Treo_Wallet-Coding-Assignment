import { theme } from '@/theme';

import {
  formatDateTime,
  limitUsedPercent,
  maskClabe,
  movementPresentation,
  statusPresentation,
} from '../display';

describe('convenciones de presentación', () => {
  test('DSG-09 una salida se muestra con − (U+2212) y la tinta, nunca con el color de error', () => {
    const out = movementPresentation('TRANSFER_OUT', '-150.00');
    expect(out).toEqual({
      label: 'Transferencia enviada',
      direction: 'out',
      amountText: '−$150.00',
      color: theme.colors.money.out,
    });
    expect(out.color).not.toBe(theme.colors.status.danger.fg);
  });

  test('DSG-09 una entrada se muestra con + y el color de dinero entrante', () => {
    expect(movementPresentation('TRANSFER_IN', '150.00')).toEqual({
      label: 'Transferencia recibida',
      direction: 'in',
      amountText: '+$150.00',
      color: theme.colors.money.in,
    });
    expect(movementPresentation('DEPOSIT', '25000.00').amountText).toBe('+$25,000.00');
  });

  test('DSG-10 un traspaso enviado tiene la etiqueta del paquete y dirección de salida', () => {
    const own = movementPresentation('OWN_TRANSFER_OUT', '-3000.00');
    expect(own.label).toBe('Traspaso enviado');
    expect(own.direction).toBe('out');
    expect(own.amountText).toBe('−$3,000.00');
  });

  test('DSG-10 una transferencia pendiente usa el tono de aviso y su etiqueta', () => {
    expect(statusPresentation('PENDING_OTP')).toEqual({
      label: 'Pendiente de código',
      tone: 'warning',
      colors: theme.colors.status.warning,
    });
    expect(statusPresentation('EXPIRED').tone).toBe('neutral');
  });

  test('DSG-11 la CLABE se enmascara salvo los últimos 4 dígitos', () => {
    expect(maskClabe('646180157000009719')).toBe('•••• 9719');
    expect(maskClabe('9719')).toBe('•••• 9719');
  });

  test('DSG-11 la fecha se muestra en la zona horaria de negocio', () => {
    // 16:42 UTC = 10:42 en la Ciudad de México (UTC−6).
    expect(formatDateTime('2026-10-13T16:42:00Z')).toBe('13 oct, 10:42');
    expect(formatDateTime('2026-10-13T16:42:00Z', { withYear: true })).toBe('13 oct 2026, 10:42');
  });

  test('MOB-15 el porcentaje usado del límite se calcula en centavos, sin floats', () => {
    expect(limitUsedPercent({ limit: '50000.00', used: '18500.00' })).toBe(37);
    expect(limitUsedPercent({ limit: '50000.00', used: '0.00' })).toBe(0);
    expect(limitUsedPercent({ limit: '50000.00', used: '50000.00' })).toBe(100);
    expect(limitUsedPercent({ limit: '0.00', used: '0.00' })).toBe(100);
    expect(limitUsedPercent({ limit: '0.30', used: '0.10' })).toBe(33);
  });
});
