/**
 * Vectores de identidad (sintéticos, sin datos de personas reales). Los dígitos verificadores de
 * CURP se calcularon a mano con el diccionario 0-9A-ZÑ y pesos 18..2:
 * - GOMC900101HDFNLR0 → suma 1991 → DV = (10 − 1) mod 10 = 9.
 * - GOMC040229MDFNLRA → suma 2080 → DV = 0 (2004 es bisiesto; la letra indica nacimiento ≥ 2000).
 * - GOMC000229HDFNLR0 → suma 1968 → DV = (10 − 8) mod 10 = 2 (carácter 17 dígito: siglo 1900).
 * - GOMC000229HDFNLRA → suma 1988 → DV = (10 − 8) mod 10 = 2 (carácter 17 letra: siglo 2000).
 * - GOMC990231HDFNLR0 → suma 2149 → DV = 1 (el dígito es correcto; lo inválido es el 31 de febrero).
 */
export const curpVectors = [
  { input: 'GOMC900101HDFNLR09', result: 'VALID' },
  { input: 'GOMC040229MDFNLRA0', result: 'VALID', note: '29 de febrero de 2004' },
  { input: 'GOMC000229HDFNLR02', result: 'INVALID_DATE', note: '1900 no es bisiesto (dígito)' },
  { input: 'GOMC000229HDFNLRA2', result: 'VALID', note: '2000 sí es bisiesto (letra)' },
  { input: 'GOMC900101HDFNLR08', result: 'INVALID_CHECK_DIGIT' },
  { input: 'GOMC990231HDFNLR01', result: 'INVALID_DATE', note: '31 de febrero' },
  { input: 'GOMC010229HDFNLR05', result: 'INVALID_DATE', note: '2001 no es bisiesto' },
  { input: 'GOMC900101HXXNLR09', result: 'INVALID_FORMAT', note: 'entidad inexistente' },
  { input: 'gomc900101hdfnlr09', result: 'INVALID_FORMAT', note: 'minúsculas' },
  { input: 'GOMC900101HDFNLR0', result: 'INVALID_FORMAT', note: '17 caracteres' },
] as const;

/** RFC de persona física: la fecha es válida si existe en 19AA o en 20AA. */
export const rfcVectors = [
  { input: 'GOMC900101AB1', result: 'VALID' },
  { input: 'MUÑO900101AB1', result: 'VALID', note: 'Ñ permitida' },
  { input: 'GOMC000229AB1', result: 'VALID', note: '29 de febrero de 2000' },
  { input: 'GOMC990231AB1', result: 'INVALID_DATE', note: '31 de febrero (escenario IDN-02)' },
  { input: 'GOMC010229AB1', result: 'INVALID_DATE', note: 'ni 1901 ni 2001 son bisiestos' },
  { input: 'GOM900101AB1', result: 'INVALID_FORMAT', note: '12 caracteres: persona moral' },
  { input: 'GOMC900101ABZ', result: 'INVALID_FORMAT', note: 'último carácter fuera de [0-9A]' },
  { input: 'gomc900101ab1', result: 'INVALID_FORMAT' },
] as const;

export const phoneVectors = [
  { input: '5512345678', e164: '+525512345678' },
  { input: '0012345678', e164: '+520012345678' },
  { input: '551234567', e164: null, note: '9 dígitos' },
  { input: '+525512345678', e164: null, note: 'se pide sin lada' },
  { input: '55 1234 5678', e164: null, note: 'con espacios' },
] as const;

export const emailVectors = [
  { input: '  Ana@Example.COM ', normalized: 'ana@example.com' },
  { input: 'luis.perez@example.com', normalized: 'luis.perez@example.com' },
] as const;
