/**
 * Vectores de CLABE compartidos por `clabe_is_valid()` en la base y por la función de dominio
 * (ACC-05): la misma tabla debe dar el mismo resultado en ambos lados. Dígitos verificadores
 * calculados a mano (pesos 3, 7, 1; cada producto módulo 10; DV = (10 − Σ mod 10) mod 10):
 * - 03218000011835971|9 → Σ = 61 → DV = 9.
 * - 03218000011835978|0 → Σ = 60 (múltiplo de 10) → DV = 0, no 10.
 */
export interface ClabeVector {
  readonly clabe: string;
  readonly valid: boolean;
  readonly note: string;
}

export const clabeVectors: readonly ClabeVector[] = [
  { clabe: '032180000118359719', valid: true, note: 'vector conocido válido' },
  { clabe: '032180000118359718', valid: false, note: 'dígito verificador incorrecto' },
  { clabe: '032180000118359780', valid: true, note: 'suma múltiplo de 10: DV 0' },
  { clabe: '032180000118359781', valid: false, note: 'suma múltiplo de 10 con DV distinto de 0' },
  { clabe: '03218000011835971', valid: false, note: '17 dígitos' },
  { clabe: '0321800001183597190', valid: false, note: '19 dígitos' },
  { clabe: '03218000011835971A', valid: false, note: 'contiene una letra' },
  { clabe: '', valid: false, note: 'vacía' },
];
