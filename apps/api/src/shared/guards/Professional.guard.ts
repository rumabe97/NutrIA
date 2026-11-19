import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ProfessionalController } from 'core/controllers/Professional';
import { UserController } from 'core/controllers/User';

import { BEFORE_PRACTICE_KEY } from '../decorators/BeforePractice.decorator.js';

import type { AuthenticatedRequest } from '../decorators/CurrentUser.decorator.js';
import type { ExecutionContext } from '@nestjs/common';

/**
 * The door to the practitioner's workspace (`0059`): the `professional` switch
 * is on **and** this account has a practice — opened by the account itself
 * since project 025 (`POST /care/practice`). Anything else is a 404, like every
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
 * **Not a practice paid for** (PRD 025 scope 2): `practiceOpen` is no longer
 * asked — a free practice reaches its clients, within its free seats.
 *
 * **Nor a suspended or closed one** (PRD 025 criterion 24): every route behind
 * this guard is a client route and is refused while a suspension stands, or
 * from the day a close comes (`ProfessionalView.restricted`, read from
 * `PracticeRestrictionRepository.standing` on every request) — unless it is
 * marked `@BeforePractice()`: the practice's own page, the agreement, the badge
 * and the profile name no client, and the page is where the practitioner reads
 * what stands. Deny by default: a route that forgets the mark is closed, not open.
 *
 * **And the agreement accepted** (`docs/legal/textos/01`): no client route
 * opens until the professional has accepted the current
 * `PROFESSIONAL_AGREEMENT_VERSION`, the same 404 otherwise. The routes marked
 * `@BeforePractice()` — the workspace's page and accepting the agreement — are
 * the way to both, so they need neither.
 *
 * **And a second factor** (PLAN 011 phase 6, `0074`): a client route reads
 * somebody else's health data, so a professional who can sign in with a
 * password must have the authenticator app on — `UserController.needsSecondFactor`,
 * the same 404 otherwise. An account with only Google or Apple passes, and so
 * does a passkey sign-in on an account with TOTP on (`0083`): the rule asks
 * about the account, never how this session was opened. The workspace's page
 * and the agreement stay open without it, `@BeforePractice()` again: the page
 * is where the professional is told to turn it on.
 *
 * Everything is read on every request and never cached, for the reason
 * `SessionGuard` re-reads the session: a suspension, a close carried out or the
 * switch thrown off closes access on the very next request.
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

    if (beforePractice) {
      return true;
    }

    if (await UserController.needsSecondFactor(user)) {
      throw new NotFoundException();
    }

    const practice = await ProfessionalController.find(user.id);

    if (!practice || practice.agreementRequired || practice.restricted) {
      throw new NotFoundException();
    }

    return true;
  }
}
