import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ProfessionalController } from 'core/controllers/Professional';

import { BEFORE_PRACTICE_KEY } from '../decorators/BeforePractice.decorator.js';

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
 * **A practice paid for, too** (`0061`): every route behind this guard is a
 * client route and also needs `practiceOpen`, which only the signed webhook
 * writes — unless it is marked `@BeforePractice()`, as the workspace's own
 * page is, because that is where the way to pay is shown. Deny by default:
 * a route that forgets the mark is closed while the practice is, not open.
 *
 * Everything is read on every request and never cached, for the reason
 * `SessionGuard` re-reads the session: revoking the grant, throwing the
 * switch off, or a practice lapsing closes access on the very next request.
 */
@Injectable()
export class ProfessionalGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!user) {
      throw new NotFoundException();
    }

    if (!(await ProfessionalController.hasAccess(user.id))) {
      throw new NotFoundException();
    }

    const beforePractice = this.reflector.getAllAndOverride<boolean | undefined>(BEFORE_PRACTICE_KEY, [context.getHandler(), context.getClass()]);

    if (!beforePractice && !(await ProfessionalController.find(user.id))?.practiceOpen) {
      throw new NotFoundException();
    }

    return true;
  }
}
