import type { User } from '@devchrisvaz/wallet-contract';
import { DomainError } from '../../../shared/errors.js';
import { toUserView } from './user-view.js';
import type { UserRepository } from './users.js';

/** `GET /me` (IDN-14): datos del usuario autenticado con CURP, RFC y teléfono enmascarados. */
export class GetCurrentUser {
  constructor(private readonly users: UserRepository) {}

  async execute(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) throw new DomainError('UNAUTHENTICATED', 'La sesión no corresponde a un usuario');
    return toUserView(user);
  }
}
