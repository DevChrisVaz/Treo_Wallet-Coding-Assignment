import { randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  type AccessTokens,
  type IssuedAccessToken,
} from '../application/tokens.js';

export interface JwtOptions {
  readonly secret: Uint8Array;
  readonly issuer: string;
  readonly audience: string;
}

/**
 * Access token JWT HS256 de 10 minutos con `sub`, `iss`, `aud`, `iat`, `exp` y `jti` (IDN-09). La
 * hora sale del puerto `Clock`, para que las pruebas controlen el vencimiento.
 */
export class JoseAccessTokens implements AccessTokens {
  constructor(private readonly options: JwtOptions) {}

  async issue(userId: string, now: Date): Promise<IssuedAccessToken> {
    const issuedAt = Math.floor(now.getTime() / 1000);
    const expiresAt = issuedAt + ACCESS_TOKEN_TTL_SECONDS;
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(userId)
      .setIssuer(this.options.issuer)
      .setAudience(this.options.audience)
      .setJti(randomUUID())
      .setIssuedAt(issuedAt)
      .setExpirationTime(expiresAt)
      .sign(this.options.secret);
    return { token, expiresAt: new Date(expiresAt * 1000) };
  }
}
