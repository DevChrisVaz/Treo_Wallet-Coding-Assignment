import { describe, expect, it } from 'vitest';
import {
  BeneficiaryClabeResolver,
  type PlatformAccountDirectory,
} from '../../../src/modules/beneficiaries/application/clabe-resolver.js';
import { buildClabe } from '../../../src/modules/accounts/domain/clabe.js';
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
