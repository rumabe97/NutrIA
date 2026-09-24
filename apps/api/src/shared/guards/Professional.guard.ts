import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';

import { ProfessionalController } from 'core/controllers/Professional';

import type { AuthenticatedRequest } from '../decorators/CurrentUser.decorator.js';
import type { ExecutionContext } from '@nestjs/common';

/**
 * The door to the dietitian's workspace (`0059`): the `professional` switch is
 * on **and** the owner granted this account. Anything else is a 404, like every
 * other denial — a 403 would tell an ordinary account that the workspace is
 * real, and the switch exists precisely so that nobody learns that before the
 * owner says so.
 *
 * That promise holds for a confirmed, open account: the global guards run
 * first, so an unconfirmed or unopened one gets their 409 here as on any real
 * route, as it does on `/admin`. For the same reason a workspace controller
 * never carries `@RequiresOnboarding()` — an ordinary account with an
 * unfinished profile would get 409 `ONBOARDING_INCOMPLETE` instead of 404.
 *
 * Not global. It is applied per controller, `@UseGuards(ProfessionalGuard)` on
 * the class, by every module of the workspace from Phase 2 of project 004 on:
 * a route of the workspace that does not carry it is a route with no door.
 * Runs after the global `SessionGuard`, so `request.user` is the session's
 * user — the only id it ever asks about.
 *
 * Both halves are read on every request and never cached, for the reason
 * `SessionGuard` re-reads the session: revoking the grant, or throwing the
 * switch off, closes access on the very next request.
 */
@Injectable()
export class ProfessionalGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!user) {
      throw new NotFoundException();
    }

    if (!(await ProfessionalController.hasAccess(user.id))) {
      throw new NotFoundException();
    }

    return true;
  }
}
