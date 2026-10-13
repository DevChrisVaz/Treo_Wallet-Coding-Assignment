import type { AuthSession, TokenPair, User } from '@devchrisvaz/wallet-contract';
import { maskCurp, maskPhone, maskRfc } from '../../../shared/masking.js';
import type { IssuedRefreshToken } from './sessions.js';
import type { IssuedAccessToken } from './tokens.js';
import type { UserRecord } from './users.js';

/** Usuario del contrato: CURP, RFC y teléfono enmascarados (IDN-14). */
export function toUserView(user: UserRecord): User {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phoneMasked: maskPhone(user.phone),
    curpMasked: maskCurp(user.curp),
    rfcMasked: maskRfc(user.rfc),
    emailVerifiedAt: (user.emailVerifiedAt ?? user.createdAt).toISOString(),
    createdAt: user.createdAt.toISOString(),
  };
}

export function toTokenPair(access: IssuedAccessToken, refresh: IssuedRefreshToken): TokenPair {
  return {
    tokenType: 'Bearer',
    accessToken: access.token,
    accessTokenExpiresAt: access.expiresAt.toISOString(),
    refreshToken: refresh.refreshToken,
    refreshTokenExpiresAt: refresh.refreshTokenExpiresAt.toISOString(),
  };
}

export function toAuthSession(
  user: UserRecord,
  access: IssuedAccessToken,
  refresh: IssuedRefreshToken,
): AuthSession {
  return { user: toUserView(user), tokens: toTokenPair(access, refresh) };
}
