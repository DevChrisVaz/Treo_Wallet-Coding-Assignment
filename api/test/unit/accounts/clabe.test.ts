import { describe, expect, it } from 'vitest';
import {
  buildClabe,
  clabeCheckDigit,
  isValidClabe,
} from '../../../src/modules/accounts/domain/clabe.js';
import { clabeVectors } from '../../vectors/clabe.js';

describe('ACC-05 dígito verificador de la CLABE en el dominio', () => {
  it.each(clabeVectors)('ACC-05 isValidClabe($clabe) = $valid ($note)', ({ clabe, valid }) => {
    expect(isValidClabe(clabe)).toBe(valid);
  });

  it('ACC-05 una suma múltiplo de 10 da dígito verificador 0, no 10', () => {
    expect(clabeCheckDigit('03218000011835978')).toBe(0);
    expect(clabeCheckDigit('03218000011835971')).toBe(9);
  });
});

describe('ACC-03 generación de CLABE', () => {
  it('ACC-03 arma banco + plaza + número de 11 dígitos + verificador', () => {
    const clabe = buildClabe({ bankCode: '999', plazaCode: '180', accountNumber: 1n });
    expect(clabe).toHaveLength(18);
    expect(clabe.startsWith('999180' + '00000000001')).toBe(true);
    expect(isValidClabe(clabe)).toBe(true);
  });

  it('ACC-03 conserva el número de cuenta más grande sin perder dígitos', () => {
    const clabe = buildClabe({ bankCode: '999', plazaCode: '180', accountNumber: 99999999999n });
    expect(clabe.slice(6, 17)).toBe('99999999999');
    expect(isValidClabe(clabe)).toBe(true);
  });

  it('ACC-03 números de cuenta distintos producen CLABE distintas', () => {
    const a = buildClabe({ bankCode: '999', plazaCode: '180', accountNumber: 41n });
    const b = buildClabe({ bankCode: '999', plazaCode: '180', accountNumber: 42n });
    expect(a).not.toBe(b);
  });

  it.each([
    ['número 0', { bankCode: '999', plazaCode: '180', accountNumber: 0n }],
    ['número de 12 dígitos', { bankCode: '999', plazaCode: '180', accountNumber: 100000000000n }],
    ['banco de 2 dígitos', { bankCode: '99', plazaCode: '180', accountNumber: 1n }],
    ['plaza con letra', { bankCode: '999', plazaCode: '18A', accountNumber: 1n }],
  ])('ACC-03 rechaza %s', (_case, input) => {
    expect(() => buildClabe(input)).toThrow(RangeError);
  });
});
