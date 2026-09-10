import { NotFoundException } from '@nestjs/common';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { OnboardingController } from 'core/controllers/Onboarding';
import { OnboardingIncompleteError } from 'core/entities/Error';

import { RequiresOnboardingGuard } from './RequiresOnboarding.guard.js';

import type { ExecutionContext } from '@nestjs/common';
import type { OnboardingView } from 'core/controllers/Onboarding';
import type { Reflector } from '@nestjs/core';

function makeContext(user?: { id: string }): ExecutionContext {
  return {
    getClass: () => class {},
    getHandler: () => () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) })
  } as unknown as ExecutionContext;
}

function makeGuard(required?: boolean) {
  return new RequiresOnboardingGuard({ getAllAndOverride: () => required } as unknown as Reflector);
}

function state(patch: Partial<OnboardingView>): OnboardingView {
  return { completedAt: null, completedSteps: [], currentStep: 1, isComplete: false, missingSteps: [], resumeStep: 1, totalSteps: 10, ...patch };
}

describe('RequiresOnboardingGuard', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('is a no-op on routes that do not ask for it', async () => {
    const getState = jest.spyOn(OnboardingController, 'getState');

    await expect(makeGuard(undefined).canActivate(makeContext({ id: 'usr-1' }))).resolves.toBe(true);
    // Not merely permitted — not even asked. Every gated request costs a read,
    // and an ungated one should cost nothing.
    expect(getState).not.toHaveBeenCalled();
  });

  it('lets a finished profile through', async () => {
    jest.spyOn(OnboardingController, 'getState').mockResolvedValue(state({ completedAt: '2026-09-07', isComplete: true, resumeStep: 9 }));

    await expect(makeGuard(true).canActivate(makeContext({ id: 'usr-1' }))).resolves.toBe(true);
  });

  it('refuses an unfinished one and says which steps are missing', async () => {
    jest.spyOn(OnboardingController, 'getState').mockResolvedValue(state({ missingSteps: ['allergies', 'cooking'], resumeStep: 6 }));

    await expect(makeGuard(true).canActivate(makeContext({ id: 'usr-1' }))).rejects.toThrow(OnboardingIncompleteError);
  });

  it('refuses when every answer is in but the flow was never closed', async () => {
    // `missingSteps` empty and `isComplete` false is the review screen, reached
    // and abandoned. One definition of done, and this is not it.
    jest.spyOn(OnboardingController, 'getState').mockResolvedValue(state({ missingSteps: [], resumeStep: 9 }));

    await expect(makeGuard(true).canActivate(makeContext({ id: 'usr-1' }))).rejects.toThrow(OnboardingIncompleteError);
  });

  it('scopes the check to the session user, never an id from the request', async () => {
    const getState = jest.spyOn(OnboardingController, 'getState').mockResolvedValue(state({ isComplete: true }));

    await makeGuard(true).canActivate(makeContext({ id: 'usr-alice' }));

    expect(getState).toHaveBeenCalledWith('usr-alice');
  });

  it('denies a request carrying no user at all', async () => {
    await expect(makeGuard(true).canActivate(makeContext())).rejects.toThrow(NotFoundException);
  });
});
