import type { Vector } from './types';

/** Esquema `PhoneInput` del contrato (CTR-12). */
export const phoneVectors: Vector[] = [
  { input: '5512345678', valid: true },
  { input: '551234567', valid: false, code: 'INVALID_FORMAT', note: '9 dígitos' },
  { input: '+525512345678', valid: false, code: 'INVALID_FORMAT', note: 'se captura sin lada' },
  { input: '55 1234 5678', valid: false, code: 'INVALID_FORMAT' },
  { input: 5512345678, valid: false, code: 'INVALID_TYPE' },
  { input: '', valid: false, code: 'REQUIRED' },
];

/**
 * Esquema `Concept` del contrato (CTR-12). La longitud se mide en puntos de código, igual que
 * JSON Schema: 40 emojis son 40 caracteres aunque ocupen 80 unidades UTF-16.
 */
export const conceptVectors: Vector[] = [
  { input: 'Renta', valid: true },
  { input: 'a', valid: true },
  { input: 'Renta de octubre', valid: true },
  { input: 'x'.repeat(40), valid: true },
  { input: '🏠'.repeat(40), valid: true, note: '40 puntos de código, 80 unidades UTF-16' },
  { input: ' Renta ', valid: false, code: 'INVALID_FORMAT', note: 'espacios en los extremos' },
  { input: 'Renta ', valid: false, code: 'INVALID_FORMAT' },
  { input: 'Renta\nOctubre', valid: false, code: 'INVALID_FORMAT', note: 'salto de línea' },
  { input: 'x'.repeat(41), valid: false, code: 'TOO_LONG' },
  { input: '   ', valid: false, code: 'REQUIRED', note: 'solo espacios' },
  { input: '', valid: false, code: 'REQUIRED' },
];

/** Esquema `Reference` del contrato (CTR-12). */
export const referenceVectors: Vector[] = [
  { input: '0', valid: true },
  { input: '1234567', valid: true },
  { input: '0001', valid: true },
  { input: '12345678', valid: false, code: 'TOO_LONG' },
  { input: '12a', valid: false, code: 'INVALID_FORMAT' },
  { input: '-1', valid: false, code: 'INVALID_FORMAT' },
  { input: 123, valid: false, code: 'INVALID_TYPE' },
  { input: '', valid: false, code: 'REQUIRED' },
];

/** Esquema `SixDigitCode` del contrato: OTP y código de verificación (CTR-12). */
export const otpVectors: Vector[] = [
  { input: '123456', valid: true },
  { input: '000000', valid: true },
  { input: '12345', valid: false, code: 'INVALID_FORMAT' },
  { input: '1234567', valid: false, code: 'INVALID_FORMAT' },
  { input: '12345a', valid: false, code: 'INVALID_FORMAT' },
  { input: 123456, valid: false, code: 'INVALID_TYPE' },
  { input: '', valid: false, code: 'REQUIRED' },
];
