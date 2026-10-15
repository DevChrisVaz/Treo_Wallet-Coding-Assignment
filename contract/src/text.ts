import type { Beneficiary } from './types';

/**
 * Deja solo dígitos (también al pegar) y recorta a `maxLength`. Para la referencia (7), los códigos
 * de 6 dígitos y el teléfono (10).
 */
export function digitsOnly(raw: string, maxLength = Number.POSITIVE_INFINITY): string {
  return raw.replace(/[^0-9]/g, '').slice(0, maxLength);
}

/**
 * Mayúsculas alfanuméricas para CURP y RFC mientras se escribe: descarta lo demás y recorta a
 * `maxLength`. Conserva `Ñ` y `&`, que sí pueden aparecer en un RFC de persona física.
 */
export function uppercaseAlphanumeric(raw: string, maxLength = Number.POSITIVE_INFINITY): string {
  return raw
    .toUpperCase()
    .replace(/[^0-9A-ZÑ&]/g, '')
    .slice(0, maxLength);
}

/** Minúsculas, sin acentos ni diéresis (`Núñez` → `nunez`) y con los espacios colapsados. */
export function normalizeForSearch(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Filtro de beneficiarios (CTR-20): sin consulta coincide todo. Una consulta solo de dígitos busca dentro
 * de la CLABE; cualquier otra busca sin distinguir mayúsculas ni acentos en el nombre y el alias,
 * y cada palabra de la consulta debe aparecer en alguno de los dos.
 */
export function matchesBeneficiary(
  beneficiary: Pick<Beneficiary, 'name' | 'alias' | 'clabe'>,
  query: string,
): boolean {
  const normalized = normalizeForSearch(query);
  if (normalized === '') return true;
  const haystack = normalizeForSearch(`${beneficiary.name} ${beneficiary.alias}`);
  if (normalized.split(' ').every((token) => haystack.includes(token))) return true;
  if (/^[0-9 ]+$/.test(normalized)) return beneficiary.clabe.includes(normalized.replace(/ /g, ''));
  return false;
}
