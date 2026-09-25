import { Inject, Injectable } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';

import { ProfessionalController } from 'core/controllers/Professional';
import { UserController } from 'core/controllers/User';

import { AUTH } from '../../auth/auth.config.js';

import type { Auth } from '../../auth/auth.config.js';
import type { IncomingHttpHeaders } from 'node:http';
import type { UserDto } from '../dto/out/index.js';

@Injectable()
export class UsersService {
  constructor(@Inject(AUTH) private readonly auth: Auth) {}

  /**
   * `professional` is the question `ProfessionalGuard` asks, asked the same way:
   * on every request, never cached, so a revoked grant or the switch thrown
   * shows on the next one. It only decides what the menu shows — nothing reads
   * it back, and every `/care` route asks the guard itself.
   */
  async me(userId: string): Promise<UserDto> {
    const [user, professional] = await Promise.all([UserController.getUser({ id: userId }), ProfessionalController.hasAccess(userId)]);

    return { ...user, professional };
  }

  /**
   * Delegated to Better Auth so the session and credential rows go with it; the
   * `ON DELETE CASCADE` from `user.id` takes the profile, plans, progress,
   * check-ins and conversations. See `packages/database/src/schemas/_utils.ts`.
   *
   * It takes the request's headers rather than a user id because Better Auth
   * deletes the account the *session* belongs to — an id would be an id
   * somebody chose, which is the one thing no delete may accept.
   */
  async remove(headers: IncomingHttpHeaders): Promise<void> {
    await this.auth.api.deleteUser({ body: {}, headers: fromNodeHeaders(headers) });
  }
}
