import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { OnboardingController } from 'core/controllers/Onboarding';
import { OnboardingIncompleteError } from 'core/entities/Error';

import { REQUIRES_ONBOARDING_KEY } from '../decorators/RequiresOnboarding.decorator.js';

import type { AuthenticatedRequest } from '../decorators/CurrentUser.decorator.js';
import type { ExecutionContext } from '@nestjs/common';

/**
 * Refuses routes marked `@RequiresOnboarding()` while any required step is
 * missing. Runs after `SessionGuard`, so `request.user` is already verified.
 *
 * **The check is the API's.** Before this guard the only thing standing between
 * a half-filled profile and a generated plan was the web app choosing not to
 * show a button — and the plan generator would happily have built a fortnight
 * out of whatever it found. A client-side gate is a suggestion; this is the
 * enforcement.
 *
 * It reads the onboarding state per request rather than trusting a flag on the
 * session, for the same reason `SessionGuard` re-reads the session: state that
 * is cached is state that is wrong.
 */
@Injectable()
export class RequiresOnboardingGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(REQUIRES_ONBOARDING_KEY, [context.getHandler(), context.getClass()]);

    if (!required) {return true;}

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!user) {throw new NotFoundException();}

    const state = await OnboardingController.getState(user.id);

    // `isComplete` is the closing step, not the sum of the parts: every answer
    // can be in and the flow still unfinished. Refusing on the flag rather than
    // on `missingSteps` keeps one definition of done — the same one
    // `OnboardingController.complete` refuses to set early.
    if (!state.isComplete) {throw new OnboardingIncompleteError(state.missingSteps);}

    return true;
  }
}
