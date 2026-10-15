import type { Vector } from './types';

/** Esquema `PhoneInput` del contrato (CTR-12). */
export const phoneVectors: Vector[] = [
  { input: '5512345678', valid: true },
  { input: '2012345678', valid: true, note: 'primer dígito 2' },
  { input: '9912345678', valid: true, note: 'primer dígito 9' },
  { input: '0512345678', valid: false, code: 'INVALID_FORMAT', note: 'empieza con 0' },
  { input: '1512345678', valid: false, code: 'INVALID_FORMAT', note: 'empieza con 1' },
  { input: '55123456789', valid: false, code: 'INVALID_FORMAT', note: '11 dígitos' },
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

/** Esquema `Password` del contrato para contraseñas nuevas (CTR-13). */
export const passwordVectors: Vector[] = [
  { input: 'una-contraseña-1', valid: true },
  { input: 'abcdefghijk1', valid: true, note: '12 caracteres, letra y dígito' },
  { input: 'ñandú-123-ñandú', valid: true, note: 'letras con acento' },
  { input: 'x'.repeat(127) + '1', valid: true, note: '128 caracteres' },
  { input: 'abcdefghij1', valid: false, code: 'TOO_SHORT', contractValid: false, note: '11' },
  { input: 'x'.repeat(128) + '1', valid: false, code: 'TOO_LONG', note: '129' },
  { input: 'sololetrasaquihay', valid: false, code: 'INVALID_FORMAT', note: 'sin dígito' },
  { input: '123456789012', valid: false, code: 'INVALID_FORMAT', note: 'sin letra' },
  { input: '------------1', valid: false, code: 'INVALID_FORMAT', note: 'sin letra' },
  { input: 1234567890123, valid: false, code: 'INVALID_TYPE' },
  { input: '', valid: false, code: 'REQUIRED' },
];

/**
 * Esquema `ScheduledInstant` del contrato (TRF-27). El patrón exige minutos exactos y desfase; no sabe
 * de calendario: un día que no existe pasa el patrón y solo el paquete lo rechaza.
 */
export const scheduledInstantVectors: Vector[] = [
  { input: '2026-10-20T14:30:00-06:00', valid: true },
  { input: '2026-10-20T20:30:00Z', valid: true },
  { input: '2026-10-20T20:30:00.000Z', valid: true, note: 'la forma que devuelve la API' },
  { input: '2028-02-29T00:00:00+00:00', valid: true, note: 'año bisiesto' },
  { input: '2026-10-20T20:30:30Z', valid: false, code: 'INVALID_FORMAT', note: 'segundos' },
  { input: '2026-10-20T20:30:00.500Z', valid: false, code: 'INVALID_FORMAT', note: 'milisegundos' },
  { input: '2026-10-20T20:30:00', valid: false, code: 'INVALID_FORMAT', note: 'sin desfase' },
  { input: '2026-10-20', valid: false, code: 'INVALID_FORMAT', note: 'solo fecha' },
  { input: '2026-10-20 20:30:00Z', valid: false, code: 'INVALID_FORMAT', note: 'sin T' },
  { input: '2026-02-30T10:00:00Z', valid: false, code: 'INVALID_FORMAT', contractValid: true },
  { input: '2026-10-20T24:00:00Z', valid: false, code: 'INVALID_FORMAT', contractValid: true },
  { input: '2026-10-20T10:61:00Z', valid: false, code: 'INVALID_FORMAT', contractValid: true },
  { input: 1792000000000, valid: false, code: 'INVALID_TYPE' },
  { input: '', valid: false, code: 'REQUIRED' },
];

/** Esquema `NamePart` del contrato: nombres y apellidos del registro (CTR-13). */
export const namePartVectors: Vector[] = [
  { input: 'Ana', valid: true },
  { input: 'José Luis', valid: true, note: 'nombre compuesto' },
  { input: "O'Brien", valid: true, note: 'apóstrofo' },
  { input: 'María-José Ñ.', valid: true, note: 'guion, ñ y punto' },
  { input: 'N'.repeat(100), valid: true, note: '100 caracteres' },
  { input: '', valid: false, code: 'REQUIRED' },
  { input: ' Ana', valid: false, code: 'INVALID_FORMAT', note: 'espacio al inicio' },
  { input: 'Ana ', valid: false, code: 'INVALID_FORMAT', note: 'espacio al final' },
  { input: 'Ana  Luz', valid: false, code: 'INVALID_FORMAT', note: 'espacios repetidos' },
  { input: 'Ana2', valid: false, code: 'INVALID_FORMAT', note: 'dígito' },
  { input: 'N'.repeat(101), valid: false, code: 'TOO_LONG' },
];

/** Esquema `OptionalNamePart` del contrato: apellido materno, vacío significa «sin apellido materno». */
export const optionalNamePartVectors: Vector[] = [
  { input: 'Cruz', valid: true },
  { input: 'de la Cruz', valid: true },
  { input: '', valid: true, note: 'vacío = omitido' },
  { input: '   ', valid: false, code: 'INVALID_FORMAT', note: 'solo espacios no es vacío' },
  { input: ' Cruz', valid: false, code: 'INVALID_FORMAT' },
  { input: 'Cruz2', valid: false, code: 'INVALID_FORMAT' },
  { input: 'N'.repeat(101), valid: false, code: 'TOO_LONG' },
];
