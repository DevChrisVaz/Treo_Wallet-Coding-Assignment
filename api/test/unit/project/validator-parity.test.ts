import {
  clabe as contractClabe,
  clabeCheckDigit as contractClabeCheckDigit,
  curp as contractCurp,
  curpCheckDigit as contractCurpCheckDigit,
  rfc as contractRfc,
  toFieldErrors,
} from '@devchrisvaz/wallet-contract';
import { describe, expect, it } from 'vitest';
import { clabeCheckDigit, isValidClabe } from '../../../src/modules/accounts/domain/clabe.js';
import { curpCheckDigit, validateCurp } from '../../../src/modules/identity/domain/curp.js';
import { validateRfc } from '../../../src/modules/identity/domain/rfc.js';

/**
 * CTR-13: el servidor aplica las mismas reglas que el paquete del contrato, pero CLABE, CURP y RFC
 * están implementadas dos veces (API y contrato). Nada más las compara: aquí cada vector pasa por
 * las dos implementaciones y deben dar el mismo veredicto. Los vectores van en una sola lista por
 * regla; el dígito verificador de cada uno se calculó a mano (ver `contract/test/vectors/identity.ts`).
 */

type Verdict = 'VALID' | 'INVALID_FORMAT' | 'INVALID_DATE' | 'INVALID_CHECK_DIGIT';

/**
 * Veredicto del paquete del contrato. La API trabaja con strings ya presentes, así que lo que el
 * paquete distingue como campo ausente o de otro tipo (REQUIRED, INVALID_TYPE) equivale en la API
 * a un formato inválido.
 */
function contractVerdict(
  schema: { safeParse: (input: unknown) => { success: boolean; error?: unknown } },
  input: string,
): Verdict {
  const result = schema.safeParse(input);
  if (result.success) return 'VALID';
  const code = toFieldErrors(result.error as Parameters<typeof toFieldErrors>[0])[0]?.code;
  if (code === 'INVALID_DATE' || code === 'INVALID_CHECK_DIGIT') return code;
  return 'INVALID_FORMAT';
}

const clabeVectors: { input: string; valid: boolean; note: string }[] = [
  { input: '032180000118359719', valid: true, note: 'válida' },
  { input: '032180000118359780', valid: true, note: 'A = 0 → dígito verificador 0, no 10' },
  { input: '002010077777777771', valid: true, note: 'otra CLABE válida' },
  { input: '032180000118359718', valid: false, note: 'dígito verificador incorrecto' },
  { input: '032180000118359710', valid: false, note: 'dígito 0 donde va el 9' },
  { input: '032180000118359789', valid: false, note: 'A = 0 pero dígito 9 en vez de 0' },
  { input: '03218000011835971', valid: false, note: '17 dígitos' },
  { input: '0321800001183597190', valid: false, note: '19 dígitos' },
  { input: '03218000011835971A', valid: false, note: 'letra' },
  { input: ' 32180000118359719', valid: false, note: 'espacio al inicio' },
  { input: '032180000118359719 ', valid: false, note: 'espacio al final' },
  { input: '0321 8000 0118 3597 19', valid: false, note: 'con espacios' },
  { input: '', valid: false, note: 'vacía' },
];

const curpVectors: { input: string; verdict: Verdict; note: string }[] = [
  { input: 'GOMC900101HDFNLR09', verdict: 'VALID', note: 'válida' },
  { input: 'GOMC040229MDFNLRA0', verdict: 'VALID', note: '29-02-2004, letra → 20xx' },
  { input: 'GOMC900101XDFNLR03', verdict: 'VALID', note: 'sexo X (no binario); suma 2127 → DV 3' },
  { input: 'GOMC000229HDFNLRA2', verdict: 'VALID', note: '29-02-00 con letra: 2000 es bisiesto' },
  { input: 'GOMC000229HDFNLR02', verdict: 'INVALID_DATE', note: '29-02-00 con dígito: 1900 no' },
  { input: 'GOMC990231HDFNLR01', verdict: 'INVALID_DATE', note: '31 de febrero' },
  { input: 'GOMC900101HDFNLR08', verdict: 'INVALID_CHECK_DIGIT', note: 'dígito incorrecto' },
  { input: 'GOMC000229HDFNLRA3', verdict: 'INVALID_CHECK_DIGIT', note: 'fecha buena, dígito malo' },
  { input: 'GOMC900101HXXNLR09', verdict: 'INVALID_FORMAT', note: 'entidad inexistente' },
  { input: 'GOMC901301HDFNLR09', verdict: 'INVALID_FORMAT', note: 'mes 13' },
  { input: 'GOMC900100HDFNLR09', verdict: 'INVALID_FORMAT', note: 'día 00' },
  { input: 'GOMC900132HDFNLR09', verdict: 'INVALID_FORMAT', note: 'día 32' },
  { input: 'GOMC900101ZDFNLR09', verdict: 'INVALID_FORMAT', note: 'sexo fuera de H, M, X' },
  { input: 'gomc900101hdfnlr09', verdict: 'INVALID_FORMAT', note: 'minúsculas' },
  { input: 'GOMC900101HDFNLR0', verdict: 'INVALID_FORMAT', note: '17 caracteres' },
  { input: 'GOMC900101HDFNLR099', verdict: 'INVALID_FORMAT', note: '19 caracteres' },
  { input: 'GOMC900101HDFNLRAA', verdict: 'INVALID_FORMAT', note: 'último carácter no es dígito' },
  { input: '', verdict: 'INVALID_FORMAT', note: 'vacía' },
];

const rfcVectors: { input: string; verdict: Verdict; note: string }[] = [
  { input: 'GOMC900101AB1', verdict: 'VALID', note: 'válido' },
  { input: 'MUÑO900101AB1', verdict: 'VALID', note: 'Ñ permitida' },
  { input: 'G&MC900101AB1', verdict: 'VALID', note: '& permitido' },
  { input: 'GOMC900101A1A', verdict: 'VALID', note: 'último carácter A' },
  { input: 'GOMC000229AB1', verdict: 'VALID', note: '29-02-00: bisiesto en 2000' },
  { input: 'GOMC040229AB1', verdict: 'VALID', note: '29-02-04: bisiesto' },
  { input: 'GOMC010229AB1', verdict: 'INVALID_DATE', note: '29-02-01: ni 1901 ni 2001' },
  { input: 'GOMC990431AB1', verdict: 'INVALID_DATE', note: '31 de abril' },
  { input: 'GOM900101AB1', verdict: 'INVALID_FORMAT', note: '12 caracteres: persona moral' },
  { input: 'GOMC900101ABZ', verdict: 'INVALID_FORMAT', note: 'último carácter fuera de [0-9A]' },
  { input: 'GOMC901301AB1', verdict: 'INVALID_FORMAT', note: 'mes 13' },
  { input: 'GOMC900100AB1', verdict: 'INVALID_FORMAT', note: 'día 00' },
  { input: 'gomc900101ab1', verdict: 'INVALID_FORMAT', note: 'minúsculas' },
  { input: 'GOMC900101AB12', verdict: 'INVALID_FORMAT', note: '14 caracteres' },
  { input: '', verdict: 'INVALID_FORMAT', note: 'vacío' },
];

describe('paridad de reglas entre la API y el contrato', () => {
  it.each(clabeVectors)('CTR-09 ACC-05 CLABE $input ($note): misma respuesta', (vector) => {
    expect(isValidClabe(vector.input)).toBe(vector.valid);
    expect(contractClabe.safeParse(vector.input).success).toBe(vector.valid);
  });

  it('CTR-09 ACC-05 el dígito verificador de CLABE coincide en 1000 prefijos de 17 dígitos', () => {
    // Recorre prefijos repartidos en todo el espacio con un paso coprimo con 10^17, de modo que
    // aparecen todos los dígitos en todas las posiciones y los valores de A (suma mod 10).
    const step = 38_461_538_461_539n;
    for (let n = 0n; n < 1000n; n += 1n) {
      const first17 = ((n * step) % 100_000_000_000_000_000n).toString().padStart(17, '0');
      expect(clabeCheckDigit(first17), first17).toBe(contractClabeCheckDigit(first17));
    }
  });

  it.each(curpVectors)('CTR-10 IDN-02 CURP $input ($note): misma respuesta', (vector) => {
    expect(validateCurp(vector.input)).toBe(vector.verdict);
    expect(contractVerdict(contractCurp, vector.input)).toBe(vector.verdict);
  });

  it('CTR-10 IDN-02 el dígito verificador de CURP coincide, con Ñ y letras en la homoclave', () => {
    const prefixes = [
      'GOMC900101HDFNLR0',
      'GOMC040229MDFNLRA',
      'GOMC000229HDFNLR0',
      'GOMC000229HDFNLRA',
      'ÑEMC850615MNELÑZ1',
      'XXXX000000XXXXXXX',
      '00000000000000000',
    ];
    for (const prefix of prefixes) {
      expect(curpCheckDigit(prefix), prefix).toBe(contractCurpCheckDigit(prefix));
    }
  });

  it.each(rfcVectors)('CTR-11 IDN-02 RFC $input ($note): misma respuesta', (vector) => {
    expect(validateRfc(vector.input)).toBe(vector.verdict);
    expect(contractVerdict(contractRfc, vector.input)).toBe(vector.verdict);
  });
});
