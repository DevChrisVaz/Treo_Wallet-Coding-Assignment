import { describe, expect, it } from 'vitest';
import {
  digitsOnly,
  matchesBeneficiary,
  normalizeForSearch,
  sanitizeAmountTyping,
  uppercaseAlphanumeric,
} from '../src/index';

describe('sanitizeAmountTyping', () => {
  it.each([
    ['', '', ''],
    ['1', '1', '1'],
    ['12345.67', '12345.67', '12,345.67'],
    ['1234567', '1234567', '1,234,567'],
    ['007', '7', '7'],
    ['000', '0', '0'],
    ['0.5', '0.5', '0.5'],
    ['00.5', '0.5', '0.5'],
    ['.5', '0.5', '0.5'],
    ['.', '0', '0.'],
    ['12.', '12', '12.'],
    ['1234.', '1234', '1,234.'],
    ['12.3', '12.3', '12.3'],
    ['12.345', '12.34', '12.34'],
    ['1.2.3', '1.23', '1.23'],
    ['abc', '', ''],
    ['1a2b3', '123', '123'],
    ['-5', '5', '5'],
    ['$1,250.50', '1250.50', '1,250.50'],
    [' 1 000 ', '1000', '1,000'],
    ['1e3', '13', '13'],
    ['1234567890123456', '123456789012', '123,456,789,012'],
  ])('CTR-20 %j → value %j, display %j', (raw, value, display) => {
    expect(sanitizeAmountTyping(raw)).toEqual({ value, display });
  });

  it('CTR-20 volver a pasar el display da el mismo resultado', () => {
    const first = sanitizeAmountTyping('9876543.21');

    expect(sanitizeAmountTyping(first.display)).toEqual(first);
  });

  it('CTR-20 el valor es un monto que el contrato acepta', () => {
    expect(sanitizeAmountTyping('1,250.5').value).toBe('1250.5');
  });
});

describe('digitsOnly y uppercaseAlphanumeric', () => {
  it('CTR-20 digitsOnly descarta lo que no sea dígito y recorta', () => {
    expect(digitsOnly('12a-3 4')).toBe('1234');
    expect(digitsOnly('1234567890', 7)).toBe('1234567');
    expect(digitsOnly('abc')).toBe('');
    expect(digitsOnly('１２３')).toBe('');
  });

  it('CTR-20 digitsOnly recorta un código pegado a 6 dígitos', () => {
    expect(digitsOnly('123 456 789', 6)).toBe('123456');
  });

  it('CTR-20 uppercaseAlphanumeric pasa a mayúsculas y conserva Ñ y &', () => {
    expect(uppercaseAlphanumeric('gomc-900101 hdf')).toBe('GOMC900101HDF');
    expect(uppercaseAlphanumeric('ñan&900101', 13)).toBe('ÑAN&900101');
    expect(uppercaseAlphanumeric('gomc900101hdfnlr09xx', 18)).toBe('GOMC900101HDFNLR09');
  });
});

describe('búsqueda de beneficiarios', () => {
  const luis = { name: 'Luis Pérez Núñez', alias: 'Casa de Luis', clabe: '032180000118359719' };
  const ana = { name: 'Ana Gómez', alias: 'Mamá', clabe: '012180001234567891' };

  it('CTR-20 normalizeForSearch pasa a minúsculas y quita acentos', () => {
    expect(normalizeForSearch('  PÉREZ   Núñez ')).toBe('perez nunez');
    expect(normalizeForSearch('Mamá')).toBe('mama');
  });

  it('CTR-20 sin consulta coincide todo', () => {
    expect(matchesBeneficiary(luis, '')).toBe(true);
    expect(matchesBeneficiary(luis, '   ')).toBe(true);
  });

  it.each([
    ['luis', true],
    ['LUIS', true],
    ['perez', true],
    ['pérez', true],
    ['nunez', true],
    ['casa', true],
    ['luis nunez', true],
    ['gomez', false],
    ['mama', false],
  ])('CTR-20 consulta %j sobre Luis → %s', (query, expected) => {
    expect(matchesBeneficiary(luis, query)).toBe(expected);
  });

  it('CTR-20 busca por alias sin acentos', () => {
    expect(matchesBeneficiary(ana, 'mama')).toBe(true);
    expect(matchesBeneficiary(ana, 'MAMÁ')).toBe(true);
  });

  it('CTR-20 una consulta de dígitos busca dentro de la CLABE', () => {
    expect(matchesBeneficiary(luis, '0321')).toBe(true);
    expect(matchesBeneficiary(luis, '359719')).toBe(true);
    expect(matchesBeneficiary(luis, '0321 8000')).toBe(true);
    expect(matchesBeneficiary(ana, '0321')).toBe(false);
    expect(matchesBeneficiary(ana, '012180')).toBe(true);
  });

  it('CTR-20 los dígitos no buscan en el nombre', () => {
    expect(matchesBeneficiary({ ...luis, name: 'Luis Pérez', alias: 'Luis' }, '9999')).toBe(false);
  });
});
