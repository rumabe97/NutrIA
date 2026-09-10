import { Inject, Injectable } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';

import { UserController } from 'core/controllers/User';

import { AUTH } from '../../auth/auth.config.js';

import type { Auth } from '../../auth/auth.config.js';
import type { IncomingHttpHeaders } from 'node:http';
import type { UserDto } from '../dto/out/index.js';

@Injectable()
export class UsersService {
  constructor(@Inject(AUTH) private readonly auth: Auth) {}

  async me(userId: string): Promise<UserDto> {
    return UserController.getUser({ id: userId });
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
