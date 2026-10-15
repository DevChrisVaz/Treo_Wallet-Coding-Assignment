import { describe, expect, it } from 'vitest';
import {
  scheduledFailureEmail,
  transferOtpEmail,
} from '../../../src/modules/transfers/application/transfer-emails.js';
import { Money } from '../../../src/shared/money.js';

describe('TRF-28 correo del OTP de una programada', () => {
  const base = {
    code: '123456',
    amount: Money.parse('15000.00'),
    destinationName: 'Luis',
    clabeLast4: '0031',
    minutes: 5,
  };

  it('TRF-28 con fecha y hora, el correo dice "Programada para el 20 de octubre de 2026, 14:30" en hora de CDMX, en texto y HTML', () => {
    // 20:30 UTC = 14:30 en CDMX (UTC-6, sin horario de verano)
    const email = transferOtpEmail({ ...base, scheduledFor: new Date('2026-10-20T20:30:00.000Z') });
    for (const body of [email.text, email.html]) {
      expect(body).toContain('Programada para el 20 de octubre de 2026, 14:30');
      expect(body).not.toContain('null');
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

describe('TRF-15 guía del correo del código', () => {
  const email = transferOtpEmail({
    code: '123456',
    amount: Money.parse('15000.00'),
    destinationName: 'Luis',
    clabeLast4: '0031',
    minutes: 5,
  });

  it('TRF-15 pide no compartir el código y responder el correo si no fue la persona', () => {
    for (const body of [email.text, email.html]) {
      expect(body).toContain('no compartas este código con nadie');
      expect(body).toContain('responde este correo');
    }
  });

  it('TRF-15 no pide cambiar la contraseña, porque el producto no tiene ese flujo', () => {
    for (const body of [email.text, email.html, email.subject]) {
      expect(body).not.toMatch(/contraseña/i);
    }
  });
});

describe('TRF-35 aviso de falla de una programada', () => {
  const base = {
    amount: Money.parse('1000.00'),
    destinationName: 'Luis',
    clabeLast4: '0031',
    scheduledFor: new Date('2026-10-15T15:05:00.000Z'), // 09:05 en CDMX
  };

  it('TRF-35 por saldo: monto, destino, últimos 4 dígitos, fecha y hora en palabras y "saldo insuficiente"', () => {
    const email = scheduledFailureEmail({ ...base, reason: 'INSUFFICIENT_FUNDS' });
    expect(email.subject).toBe('Tu transferencia programada no se realizó');
    for (const body of [email.text, email.html]) {
      expect(body).toContain('$1,000.00');
      expect(body).toContain('Luis');
      expect(body).toContain('0031');
      expect(body).toContain('15 de octubre de 2026, 09:05');
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
