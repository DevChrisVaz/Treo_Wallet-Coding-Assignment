import { describe, expect, it } from 'vitest';
import {
  longSpanishDate,
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
