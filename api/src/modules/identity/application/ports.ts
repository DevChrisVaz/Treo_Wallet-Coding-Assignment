/** Hash de contraseñas (IDN-04, IDN-08). */
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
  /**
   * Verifica contra un hash ficticio calculado al arrancar, cuando el email no existe, para que el
   * login tarde lo mismo en ambos casos. Siempre devuelve `false`.
   */
  verifyDummy(password: string): Promise<false>;
}
