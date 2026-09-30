import { Inject, Injectable, Logger } from '@nestjs/common';
import { isAPIError } from 'better-auth/api';
import { fromNodeHeaders } from 'better-auth/node';

import { ProfessionalController } from 'core/controllers/Professional';
import { UserController } from 'core/controllers/User';
import { ReauthenticationRequiredError } from 'core/entities/Error';

import { AUTH } from '../../auth/auth.config.js';

import type { Auth } from '../../auth/auth.config.js';
import type { IncomingHttpHeaders } from 'node:http';
import type { UserDto } from '../dto/out/index.js';

/** Better Auth's code for a session too old for a sensitive act (`BASE_ERROR_CODES.SESSION_EXPIRED`). */
const SESSION_EXPIRED = 'SESSION_EXPIRED';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(@Inject(AUTH) private readonly auth: Auth) {}

  /**
   * `professional` is the question `ProfessionalGuard` asks, asked the same way:
   * on every request, never cached, so a revoked grant or the switch thrown
   * shows on the next one. It only decides what the menu shows — nothing reads
   * it back, and every `/care` route asks the guard itself.
   *
   * A failed read answers false rather than failing the route: every screen of
   * the app is gated on this one, and the workspace's tables must not take it
   * down for everybody. False is the closed answer, and the guard still asks.
   */
  async me(userId: string): Promise<UserDto> {
    const [user, professional] = await Promise.all([
      UserController.getUser({ id: userId }),
      ProfessionalController.hasAccess(userId).catch((error: unknown) => {
        this.logger.warn(`Could not tell whether ${userId} is a professional: ${String(error)}`);

        return false;
      })
    ]);

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
   *
   * No password is passed, on purpose: Better Auth then asks for a *fresh*
   * session (created within `freshAge`, one day) and refuses an older one with
   * `SESSION_EXPIRED`, before `beforeDelete` runs (Stripe, invitations) and
   * before any row goes. So a refused delete touches nothing. That refusal
   * becomes `ReauthenticationRequiredError` (409 `REAUTHENTICATION_REQUIRED`):
   * sign in again, then delete. A password is not accepted in its place because
   * Better Auth's rate limit does not cover a call made from here, and this
   * route would become an unthrottled password oracle for a stolen session.
   * Any other refusal goes on to `AllExceptionsFilter`, which translates it.
   */
  async remove(headers: IncomingHttpHeaders): Promise<void> {
    try {
      await this.auth.api.deleteUser({ body: {}, headers: fromNodeHeaders(headers) });
    } catch (error) {
      if (isAPIError(error) && (error.body as { code?: unknown } | undefined)?.code === SESSION_EXPIRED) {
        throw new ReauthenticationRequiredError();
      }

      throw error;
    }
  }
}
