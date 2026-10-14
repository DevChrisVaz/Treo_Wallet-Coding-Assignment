/** Normaliza un email: sin espacios en los extremos y en minúsculas (IDN-02). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
