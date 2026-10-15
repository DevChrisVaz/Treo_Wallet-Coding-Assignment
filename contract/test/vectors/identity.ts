import type { Vector } from './types';

/**
 * Esquema `Clabe` del contrato (CTR-09). Dígito verificador calculado a mano:
 * - 032180000118359719: Σ(productos mod 10) = 61 → A = 1 → DV = 9.
 * - 032180000118359780: Σ = 60 → A = 0 → DV = (10 − 0) mod 10 = 0 (no 10).
 */
export const clabeVectors: Vector[] = [
  { input: '032180000118359719', valid: true },
  { input: '032180000118359780', valid: true, note: 'A = 0 → dígito verificador 0' },
  {
    input: '032180000118359718',
    valid: false,
    code: 'INVALID_CHECK_DIGIT',
    contractValid: true,
    note: 'el patrón del contrato no revisa el dígito verificador',
  },
  { input: '03218000011835971', valid: false, code: 'INVALID_FORMAT', note: '17 dígitos' },
  { input: '03218000011835971A', valid: false, code: 'INVALID_FORMAT' },
  { input: '032180000118359719 ', valid: false, code: 'INVALID_FORMAT' },
  {
    // Como número, una CLABE pierde el 0 inicial y, con 17 dígitos, ya no es exacta (> 2^53).
    input: 2180000118359719,
    valid: false,
    code: 'INVALID_TYPE',
    note: 'número en lugar de string',
  },
  { input: '', valid: false, code: 'REQUIRED' },
];

/**
 * Esquema `Curp` del contrato (CTR-10). CURPs sintéticas, sin datos de personas reales.
 * Dígito verificador (diccionario 0-9A-ZÑ, pesos 18..2) calculado a mano:
 * - GOMC900101HDFNLR0 → suma 1991 → DV = (10 − 1) mod 10 = 9.
 * - GOMC040229MDFNLRA → suma 2080 → DV = 0 (2004 es bisiesto; la letra indica nacimiento ≥ 2000).
 * - GOMC990231HDFNLR0 → suma 2149 → DV = 1 (el dígito es correcto; lo inválido es el 31 de febrero).
 * - GOMC000229HDFNLR0 → suma 1968 → DV = 2; GOMC000229HDFNLRA → suma 1988 → DV = 2. Misma fecha 00-02-29,
 *   distinto carácter 17: con dígito el siglo es 1900 (no bisiesto), con letra es 2000 (bisiesto).
 */
export const curpVectors: Vector[] = [
  { input: 'GOMC900101HDFNLR09', valid: true },
  { input: 'GOMC040229MDFNLRA0', valid: true, note: '29 de febrero de 2004' },
  { input: 'GOMC000229HDFNLRA2', valid: true, note: '29-02-00 con letra: 2000 es bisiesto' },
  {
    input: 'GOMC000229HDFNLR02',
    valid: false,
    code: 'INVALID_DATE',
    contractValid: true,
    note: '29-02-00 con dígito: 1900 no es bisiesto',
  },
  {
    input: 'GOMC900101HDFNLR08',
    valid: false,
    code: 'INVALID_CHECK_DIGIT',
    contractValid: true,
  },
  {
    input: 'GOMC990231HDFNLR01',
    valid: false,
    code: 'INVALID_DATE',
    contractValid: true,
    note: 'el patrón del contrato acepta el día 31 en febrero',
  },
  {
    input: 'GOMC900101HXXNLR09',
    valid: false,
    code: 'INVALID_FORMAT',
    note: 'entidad inexistente',
  },
  { input: 'gomc900101hdfnlr09', valid: false, code: 'INVALID_FORMAT', note: 'minúsculas' },
  { input: 'GOMC900101HDFNLR0', valid: false, code: 'INVALID_FORMAT', note: '17 caracteres' },
  { input: '', valid: false, code: 'REQUIRED' },
];

/**
 * Esquema `Rfc` del contrato (CTR-11), persona física. RFCs sintéticos. El RFC no indica el siglo,
 * así que una fecha es válida si existe en 19AA o en 20AA.
 */
export const rfcVectors: Vector[] = [
  { input: 'GOMC900101AB1', valid: true },
  { input: 'MUÑO900101AB1', valid: true, note: 'Ñ permitida' },
  { input: 'GOMC000229AB1', valid: true, note: '29 de febrero de 2000 (bisiesto)' },
  {
    input: 'GOMC010229AB1',
    valid: false,
    code: 'INVALID_DATE',
    contractValid: true,
    note: '29 de febrero no existe ni en 1901 ni en 2001',
  },
  {
    input: 'GOM900101AB1',
    valid: false,
    code: 'INVALID_FORMAT',
    note: '12 caracteres: persona moral',
  },
  {
    input: 'GOMC900101ABZ',
    valid: false,
    code: 'INVALID_FORMAT',
    note: 'último carácter fuera de [0-9A]',
  },
  { input: 'gomc900101ab1', valid: false, code: 'INVALID_FORMAT' },
  { input: '', valid: false, code: 'REQUIRED' },
];

/** Esquema `BirthDate` del contrato: que exista en el calendario se valida fuera del schema. */
export const birthDateVectors: Vector[] = [
  { input: '1990-01-01', valid: true },
  { input: '2008-02-29', valid: true, note: 'año bisiesto' },
  {
    input: '1990-02-30',
    valid: false,
    contractValid: true,
    code: 'INVALID_DATE',
    note: 'no existe',
  },
  { input: '1990-1-1', valid: false, code: 'INVALID_FORMAT' },
  { input: '1990-01-01T00:00:00Z', valid: false, code: 'INVALID_FORMAT' },
  { input: '01/01/1990', valid: false, code: 'INVALID_FORMAT' },
  { input: '1990-13-01', valid: false, code: 'INVALID_FORMAT' },
];

/** Esquema `BirthState` del contrato: los 33 códigos de la CURP, en mayúsculas. */
export const birthStateVectors: Vector[] = [
  { input: 'DF', valid: true },
  { input: 'NE', valid: true, note: 'nacido en el extranjero' },
  { input: 'df', valid: false, code: 'INVALID_FORMAT' },
  { input: 'XX', valid: false, code: 'INVALID_FORMAT' },
  { input: 'DFX', valid: false, code: 'INVALID_FORMAT' },
  { input: '', valid: false, code: 'REQUIRED' },
];
