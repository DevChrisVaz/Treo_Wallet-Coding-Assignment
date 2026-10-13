const WEIGHTS = [3, 7, 1] as const;
const MAX_ACCOUNT_NUMBER = 99_999_999_999n;

/**
 * Dígito verificador de una CLABE a partir de sus primeros 17 dígitos (ACC-05): cada dígito por su
 * peso (3, 7, 1 repetidos), cada producto módulo 10, y DV = (10 − Σ mod 10) mod 10. Es la misma
 * regla que `clabe_is_valid()` en la base, probada con los mismos vectores.
 */
export function clabeCheckDigit(first17: string): number {
  let sum = 0;
  for (let i = 0; i < 17; i += 1) sum += (Number(first17[i]) * (WEIGHTS[i % 3] ?? 0)) % 10;
  return (10 - (sum % 10)) % 10;
}

/** CLABE de exactamente 18 dígitos con dígito verificador correcto. */
export function isValidClabe(clabe: string): boolean {
  return /^[0-9]{18}$/.test(clabe) && clabeCheckDigit(clabe.slice(0, 17)) === Number(clabe[17]);
}

/**
 * CLABE de una cuenta nueva (ACC-03): banco (3) + plaza (3) + número de cuenta de la secuencia de
 * la base (11, con ceros a la izquierda) + dígito verificador.
 */
export function buildClabe(input: {
  readonly bankCode: string;
  readonly plazaCode: string;
  readonly accountNumber: bigint;
}): string {
  if (!/^[0-9]{3}$/.test(input.bankCode) || !/^[0-9]{3}$/.test(input.plazaCode)) {
    throw new RangeError('El banco y la plaza deben tener 3 dígitos');
  }
  if (input.accountNumber < 1n || input.accountNumber > MAX_ACCOUNT_NUMBER) {
    throw new RangeError('El número de cuenta debe tener a lo más 11 dígitos');
  }
  const first17 = `${input.bankCode}${input.plazaCode}${input.accountNumber.toString().padStart(11, '0')}`;
  return `${first17}${clabeCheckDigit(first17)}`;
}
