'use server';

import { beneficiaryForm, type Beneficiary } from '@devchrisvaz/wallet-contract';
import type { ActionResult } from '@/lib/action-result';
import { sessionAction } from '@/lib/server/action';

/**
 * Alta de beneficiario (WEB-15): valida nombre, alias y CLABE (formato y dígito verificador) con el
 * esquema del contrato y exige la sesión antes de llamar a la API (WEB-07). La API responde 201, o
 * 200 si ya existía con los mismos datos; ambos devuelven el beneficiario.
 */
export async function createBeneficiary(input: unknown): Promise<ActionResult<Beneficiary>> {
  return sessionAction(beneficiaryForm, input, async ({ data, api }) => {
    const { data: beneficiary } = await api.POST('/beneficiaries', { body: data });
    if (!beneficiary) throw new Error('createBeneficiary respondió sin beneficiario');
    return beneficiary;
  });
}
