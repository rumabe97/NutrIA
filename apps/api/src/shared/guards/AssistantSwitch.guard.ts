import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';

import { OnboardingController } from 'core/controllers/Onboarding';
import { OnboardingIncompleteError } from 'core/entities/Error';
import { SettingsController } from 'core/controllers/Settings';

import type { AuthenticatedRequest } from '../decorators/CurrentUser.decorator.js';
import type { ExecutionContext } from '@nestjs/common';

/**
 * The assistant answers only while its switch is on (project 023, `0104`).
 *
 * Off, asking it and reading where one stands answer 404, like a route that was
 * never written. **The switch is read before onboarding**, which is why this
 * guard checks onboarding itself rather than the route carrying
 * `@RequiresOnboarding()`: the global onboarding guard runs before any
 * controller guard, and its 409 would tell an unfinished account, switch off,
 * that the route exists. What an account's own state answers everywhere —
 * an unverified address, a password that must change — still comes first.
 *
 * **Reading and deleting conversations are not behind it**, on purpose: a
 * switch thrown off after launch must not leave anybody unable to delete what
 * they said (PRD 10).
 */
@Injectable()
export class AssistantSwitchGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!(await SettingsController.flags()).assistant) {
      throw new NotFoundException();
    }

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!user) {
      throw new NotFoundException();
    }

    const state = await OnboardingController.getState(user.id);

    if (!state.isComplete) {
      throw new OnboardingIncompleteError(state.missingSteps);
    }

    return true;
  }
}
