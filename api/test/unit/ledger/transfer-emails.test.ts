import { describe, expect, it } from 'vitest';
import {
  longSpanishDate,
  scheduledFailureEmail,
  transferOtpEmail,
} from '../../../src/modules/transfers/application/transfer-emails.js';
import { Money } from '../../../src/shared/money.js';

describe('TRF-28 fecha programada en palabras', () => {
  it.each([
    ['2026-10-20', '20 de octubre de 2026'],
    ['2027-01-01', '1 de enero de 2027'],
    ['2028-02-29', '29 de febrero de 2028'],
    ['2026-12-31', '31 de diciembre de 2026'],
  ])('TRF-28 %s se escribe "%s" sin pasar por zonas horarias', (day, text) => {
    expect(longSpanishDate(day)).toBe(text);
  });
});

describe('TRF-28 correo del OTP de una programada', () => {
  const base = {
    code: '123456',
    amount: Money.parse('15000.00'),
    destinationName: 'Luis',
    clabeLast4: '0031',
    minutes: 5,
  };

  it('TRF-28 con fecha, el correo dice "Programada para el 20 de octubre de 2026." en texto y HTML', () => {
    const email = transferOtpEmail({ ...base, scheduledFor: '2026-10-20' });
    for (const body of [email.text, email.html]) {
      expect(body).toContain('Programada para el 20 de octubre de 2026.');
      expect(body).toContain('$15,000.00');
      expect(body).toContain('0031');
    }
  });

  it('TRF-15 sin fecha, el correo de una inmediata no cambia', () => {
    const email = transferOtpEmail({ ...base, scheduledFor: null });
    expect(email.text).not.toContain('Programada');
    expect(email).toEqual(transferOtpEmail(base));
  });
});

describe('TRF-35 aviso de falla de una programada', () => {
  const base = {
    amount: Money.parse('1000.00'),
    destinationName: 'Luis',
    clabeLast4: '0031',
    scheduledFor: '2026-10-15',
  };

  it('TRF-35 por saldo: monto, destino, últimos 4 dígitos, fecha en palabras y "saldo insuficiente"', () => {
    const email = scheduledFailureEmail({ ...base, reason: 'INSUFFICIENT_FUNDS' });
    expect(email.subject).toBe('Tu transferencia programada no se realizó');
    for (const body of [email.text, email.html]) {
      expect(body).toContain('$1,000.00');
      expect(body).toContain('Luis');
      expect(body).toContain('0031');
      expect(body).toContain('15 de octubre de 2026');
      expect(body).toContain('saldo insuficiente');
    }
  });

  it('TRF-35 por límite: "se alcanzó el límite diario de transferencias"', () => {
    const email = scheduledFailureEmail({ ...base, reason: 'DAILY_LIMIT_EXCEEDED' });
    expect(email.text).toContain('se alcanzó el límite diario de transferencias');
    expect(email.html).toContain('se alcanzó el límite diario de transferencias');
  });

  it('TRF-35 escapa el nombre del destino en el HTML', () => {
    const email = scheduledFailureEmail({
      ...base,
      destinationName: '<b>Luis</b>',
      reason: 'INSUFFICIENT_FUNDS',
    });
    expect(email.html).not.toContain('<b>Luis</b>');
    expect(email.html).toContain('&lt;b&gt;Luis&lt;/b&gt;');
  });
});
