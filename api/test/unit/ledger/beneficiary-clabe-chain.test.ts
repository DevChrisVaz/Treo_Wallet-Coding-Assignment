import { describe, expect, it } from 'vitest';
import {
  BeneficiaryClabeResolver,
  type PlatformAccountDirectory,
} from '../../../src/modules/beneficiaries/application/clabe-resolver.js';
import { buildClabe } from '../../../src/modules/accounts/domain/clabe.js';
import { checkBeneficiaryClabe } from '../../../src/modules/beneficiaries/domain/beneficiary-clabe.js';
import { clabeVectors } from '../../vectors/clabe.js';
import { DomainError } from '../../../src/shared/errors.js';

const ANA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const LUIS = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const luisClabe = buildClabe({ bankCode: '999', plazaCode: '180', accountNumber: 7n });
const anaClabe = buildClabe({ bankCode: '999', plazaCode: '180', accountNumber: 8n });

const directory: PlatformAccountDirectory = {
  findUserAccountByClabe: async (clabe) =>
    clabe === luisClabe
      ? { accountId: 'luis-principal', ownerId: LUIS }
      : clabe === anaClabe
        ? { accountId: 'ana-ahorro', ownerId: ANA }
        : null,
};

const resolver = new BeneficiaryClabeResolver(directory, '999');

async function codeOf(clabe: string): Promise<string> {
  try {
    await resolver.resolve(ANA, clabe);
    return 'OK';
  } catch (error) {
    return error instanceof DomainError ? error.code : 'otro error';
  }
}

describe('BEN-06 cadena de validación de la CLABE del beneficiario', () => {
  it('BEN-01 resuelve la cuenta de la plataforma que corresponde a la CLABE', async () => {
    expect(await resolver.resolve(ANA, luisClabe)).toEqual({
      accountId: 'luis-principal',
      ownerId: LUIS,
    });
  });

  it('BEN-03 un dígito verificador incorrecto es CLABE_INVALID', async () => {
    const wrong = `${luisClabe.slice(0, 17)}${(Number(luisClabe[17]) + 1) % 10}`;
    expect(await codeOf(wrong)).toBe('CLABE_INVALID');
  });

  it('BEN-04 una CLABE válida de otro banco es CLABE_NOT_IN_PLATFORM', async () => {
    expect(await codeOf('032180000118359719')).toBe('CLABE_NOT_IN_PLATFORM');
  });

  it('BEN-04 una CLABE válida de la plataforma sin cuenta USER es CLABE_NOT_IN_PLATFORM', async () => {
    expect(
      await codeOf(buildClabe({ bankCode: '999', plazaCode: '180', accountNumber: 99n })),
    ).toBe('CLABE_NOT_IN_PLATFORM');
  });

  it('BEN-05 una CLABE de una cuenta propia es BENEFICIARY_IS_OWN_ACCOUNT', async () => {
    expect(await codeOf(anaClabe)).toBe('BENEFICIARY_IS_OWN_ACCOUNT');
  });
});

/** Una CLABE de la plataforma cuyo dígito verificador es 0 (suma ponderada múltiplo de 10). */
function platformClabeWithZeroCheckDigit(): string {
  for (let n = 1n; n < 1000n; n += 1n) {
    const clabe = buildClabe({ bankCode: '999', plazaCode: '180', accountNumber: n });
    if (clabe.endsWith('0')) return clabe;
  }
  throw new Error('sin CLABE con DV 0');
}

function withCheckDigit(clabe: string, digit: number): string {
  return `${clabe.slice(0, 17)}${digit}`;
}

describe('BEN-03 dígito verificador y orden de los errores', () => {
  it.each(clabeVectors.filter((vector) => /^[0-9]{18}$/.test(vector.clabe)))(
    'BEN-03 $clabe ($note) con banco ajeno: verificador antes que banco',
    ({ clabe, valid }) => {
      expect(checkBeneficiaryClabe(clabe, '999')).toBe(
        valid ? 'CLABE_NOT_IN_PLATFORM' : 'CLABE_INVALID',
      );
    },
  );

  it('BEN-03 una CLABE con suma múltiplo de 10 acepta el verificador 0 y rechaza cualquier otro', async () => {
    const clabe = platformClabeWithZeroCheckDigit();
    const local = new BeneficiaryClabeResolver(
      {
        findUserAccountByClabe: async (c) =>
          c === clabe ? { accountId: 'x', ownerId: LUIS } : null,
      },
      '999',
    );
    await expect(local.resolve(ANA, clabe)).resolves.toEqual({ accountId: 'x', ownerId: LUIS });
    for (let digit = 1; digit <= 9; digit += 1) {
      await expect(local.resolve(ANA, withCheckDigit(clabe, digit))).rejects.toMatchObject({
        code: 'CLABE_INVALID',
      });
    }
  });

  it('BEN-06 una CLABE de otro banco con verificador incorrecto es CLABE_INVALID, no CLABE_NOT_IN_PLATFORM', async () => {
    expect(await codeOf('032180000118359718')).toBe('CLABE_INVALID');
  });

  it('BEN-06 una CLABE propia con verificador incorrecto es CLABE_INVALID, no BENEFICIARY_IS_OWN_ACCOUNT', async () => {
    expect(await codeOf(withCheckDigit(anaClabe, (Number(anaClabe[17]) + 1) % 10))).toBe(
      'CLABE_INVALID',
    );
  });

  it('BEN-06 una CLABE de la plataforma sin cuenta va antes que la regla de cuenta propia', async () => {
    const lookups: string[] = [];
    const local = new BeneficiaryClabeResolver(
      {
        findUserAccountByClabe: async (clabe) => {
          lookups.push(clabe);
          return null;
        },
      },
      '999',
    );
    await expect(local.resolve(ANA, '032180000118359719')).rejects.toMatchObject({
      code: 'CLABE_NOT_IN_PLATFORM',
    });
    // Con banco ajeno ni siquiera se consulta el directorio de cuentas.
    expect(lookups).toEqual([]);
  });
});
