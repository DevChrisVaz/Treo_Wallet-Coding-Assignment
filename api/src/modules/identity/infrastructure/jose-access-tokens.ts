import { randomUUID } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import type { AccessTokenVerifier } from '../../../platform/http/auth.js';
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
export class JoseAccessTokens implements AccessTokens, AccessTokenVerifier {
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

  /**
   * Acepta solo HS256 (nunca `none` ni otro algoritmo), con firma, `iss`, `aud` y vigencia
   * correctos respecto de la hora del puerto `Clock` (IDN-09).
   */
  async verify(token: string, now: Date): Promise<{ userId: string }> {
    const { payload } = await jwtVerify(token, this.options.secret, {
      algorithms: ['HS256'],
      issuer: this.options.issuer,
      audience: this.options.audience,
      currentDate: now,
      requiredClaims: ['sub', 'iat', 'exp', 'jti'],
    });
    if (typeof payload.sub !== 'string') throw new Error('El token no trae sub');
    return { userId: payload.sub };
  }
}
