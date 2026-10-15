import { describe, expect, it } from 'vitest';
import { BIRTH_STATES, BIRTH_STATE_CODES, curpBirthState, isBirthStateCode } from '../../src/index';

const CURP_WITH = (state: string) => `GOMC900101H${state}NLR09`;

describe('catálogo de entidades de nacimiento', () => {
  it('CTR-21 tiene 33 entradas sin códigos repetidos y NE al final', () => {
    expect(BIRTH_STATES).toHaveLength(33);
    expect(new Set(BIRTH_STATES.map((state) => state.code)).size).toBe(33);
    expect(BIRTH_STATES.at(-1)).toEqual({ code: 'NE', name: 'Nacido en el extranjero' });
  });

  it('CTR-21 DF es Ciudad de México', () => {
    expect(BIRTH_STATES.find((state) => state.code === 'DF')?.name).toBe('Ciudad de México');
  });

  it.each(BIRTH_STATE_CODES)('CTR-21 el patrón de la CURP acepta %s', (code) => {
    expect(curpBirthState(CURP_WITH(code))).toBe(code);
  });

  it.each(['XX', 'ZZ'])('CTR-21 el patrón de la CURP rechaza %s', (code) => {
    expect(curpBirthState(CURP_WITH(code))).toBeNull();
  });

  it.each(['DF', 'NE', 'JC'])('CTR-21 isBirthStateCode acepta %s', (code) => {
    expect(isBirthStateCode(code)).toBe(true);
  });

  it.each(['df', 'XX', '', 'DFX', ' DF'])('CTR-21 isBirthStateCode rechaza %j', (code) => {
    expect(isBirthStateCode(code)).toBe(false);
  });
});
