/** Vigencia del access token: 10 minutos (IDN-09). */
export const ACCESS_TOKEN_TTL_SECONDS = 600;

export interface IssuedAccessToken {
  readonly token: string;
  readonly expiresAt: Date;
}

/** Access tokens JWT firmados con HS256 (IDN-09). */
export interface AccessTokens {
  issue(userId: string, now: Date): Promise<IssuedAccessToken>;
}
