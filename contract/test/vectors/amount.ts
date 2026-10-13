import type { AmountVector } from './types';

/** Esquema `AmountInput` del contrato (CTR-08). */
export const amountVectors: AmountVector[] = [
  { input: '1250.50', valid: true, cents: 125050n },
  { input: '1250.5', valid: true, cents: 125050n },
  { input: '1250', valid: true, cents: 125000n },
  { input: '0.01', valid: true, cents: 1n, note: 'mínimo' },
  { input: '1.15', valid: true, cents: 115n, note: 'con floats, 1.15 * 100 = 114.99999999999999' },
  { input: '0.10', valid: true, cents: 10n },
  { input: '0.20', valid: true, cents: 20n },
  { input: '999999999999.99', valid: true, cents: 99999999999999n, note: '12 dígitos enteros' },

  { input: '100.005', valid: false, code: 'TOO_MANY_DECIMALS', note: 'redondeo: se rechaza' },
  { input: 1250.5, valid: false, code: 'INVALID_TYPE', note: 'número JSON' },
  { input: '', valid: false, code: 'REQUIRED' },
  { input: '0', valid: false, code: 'NOT_POSITIVE' },
  { input: '0.00', valid: false, code: 'NOT_POSITIVE' },
  { input: '-5.00', valid: false, code: 'INVALID_FORMAT' },
  { input: '1,250.50', valid: false, code: 'INVALID_FORMAT' },
  { input: '1e3', valid: false, code: 'INVALID_FORMAT' },
  { input: ' 10.00', valid: false, code: 'INVALID_FORMAT' },
  { input: '.50', valid: false, code: 'INVALID_FORMAT' },
  { input: '10.', valid: false, code: 'INVALID_FORMAT' },
  { input: '007.00', valid: false, code: 'INVALID_FORMAT' },
  { input: '9999999999999.00', valid: false, code: 'TOO_LARGE', note: '13 dígitos enteros' },
];
