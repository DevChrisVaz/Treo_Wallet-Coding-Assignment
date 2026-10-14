import { DomainError } from '../../../shared/errors.js';
import { checkBeneficiaryClabe } from '../domain/beneficiary-clabe.js';

/** Búsqueda de una cuenta USER de la plataforma por su CLABE. */
export interface PlatformAccountDirectory {
  findUserAccountByClabe(clabe: string): Promise<{ accountId: string; ownerId: string } | null>;
}

const MESSAGES = {
  CLABE_INVALID: 'El dígito verificador de la CLABE no es válido',
  CLABE_NOT_IN_PLATFORM: 'La CLABE no corresponde a una cuenta de la plataforma',
  BENEFICIARY_IS_OWN_ACCOUNT:
    'La CLABE es de una de tus cuentas; usa un traspaso entre cuentas propias',
} as const;

/**
 * Cadena de validación de BEN-06, en orden, respondiendo con el primer error: dígito verificador,
 * código de banco de la plataforma, cuenta USER existente y cuenta propia. Devuelve la cuenta a la
 * que apunta la CLABE (se guarda resuelta en el beneficiario).
 */
export class BeneficiaryClabeResolver {
  constructor(
    private readonly directory: PlatformAccountDirectory,
    private readonly platformBankCode: string,
  ) {}

  async resolve(userId: string, clabe: string): Promise<{ accountId: string; ownerId: string }> {
    const problem = checkBeneficiaryClabe(clabe, this.platformBankCode);
    if (problem) throw new DomainError(problem, MESSAGES[problem]);
    const account = await this.directory.findUserAccountByClabe(clabe);
    if (!account) {
      throw new DomainError('CLABE_NOT_IN_PLATFORM', MESSAGES.CLABE_NOT_IN_PLATFORM);
    }
    if (account.ownerId === userId) {
      throw new DomainError('BENEFICIARY_IS_OWN_ACCOUNT', MESSAGES.BENEFICIARY_IS_OWN_ACCOUNT);
    }
    return account;
  }
}
