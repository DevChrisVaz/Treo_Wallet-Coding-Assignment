/**
 * Teléfono nacional de 10 dígitos a formato E.164 de México (`+52` + 10 dígitos), o `null` si no es
 * un teléfono nacional (IDN-02).
 */
export function toE164(national: string): string | null {
  return /^[0-9]{10}$/.test(national) ? `+52${national}` : null;
}
