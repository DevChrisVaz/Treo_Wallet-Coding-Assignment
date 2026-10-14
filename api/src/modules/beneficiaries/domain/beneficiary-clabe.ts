import { isValidClabe } from '../../accounts/domain/clabe.js';

export type ClabeFormatProblem = 'CLABE_INVALID' | 'CLABE_NOT_IN_PLATFORM';

/**
 * Primeros pasos de la cadena de BEN-06, puros: dígito verificador (BEN-03) y código de banco de la
 * plataforma (BEN-04). El formato de 18 dígitos ya lo validó el esquema de entrada.
 */
export function checkBeneficiaryClabe(
  clabe: string,
  platformBankCode: string,
): ClabeFormatProblem | null {
  if (!isValidClabe(clabe)) return 'CLABE_INVALID';
  if (!clabe.startsWith(platformBankCode)) return 'CLABE_NOT_IN_PLATFORM';
  return null;
}
