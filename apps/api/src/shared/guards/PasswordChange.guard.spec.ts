import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, jest } from '@jest/globals';
import { Reflector } from '@nestjs/core';
import { dirname, join } from 'node:path';

import { EmailNotVerifiedError, OnboardingIncompleteError, PasswordChangeRequiredError } from 'core/entities/Error';
import { OnboardingController } from 'core/controllers/Onboarding';

import { ALLOW_PASSWORD_CHANGE_PENDING_KEY } from '../decorators/AllowPasswordChangePending.decorator.js';
import { AuthController } from '../../modules/auth/controllers/Auth.controller.js';
import { GLOBAL_GUARDS } from './GlobalGuards.js';
import { IS_PUBLIC_KEY } from '../decorators/Public.decorator.js';
import { PasswordChangeGuard } from './PasswordChange.guard.js';
import { REQUIRES_ONBOARDING_KEY } from '../decorators/RequiresOnboarding.decorator.js';
import { RequiresOnboardingGuard } from './RequiresOnboarding.guard.js';
import { UsersController } from '../../modules/users/controllers/Users.controller.js';
import { VerifiedEmailGuard } from './VerifiedEmail.guard.js';

import type { CanActivate, ExecutionContext, Type } from '@nestjs/common';
import type { SessionUser } from '../decorators/CurrentUser.decorator.js';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Everything open unless a case says otherwise, so each case names the one state it is about. */
function makeUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'usr-1',
    activated: true,
    email: 'ana@example.invalid',
    emailVerified: true,
    name: 'Ana',
    passwordChangeRequired: false,
    role: 'user',
    ...overrides
  };
}

function makeContext(
  user: SessionUser | undefined,
  handler: (...args: never[]) => unknown = () => undefined,
  klass: Type = class {}
): ExecutionContext {
  return { getClass: () => klass, getHandler: () => handler, switchToHttp: () => ({ getRequest: () => ({ user }) }) } as unknown as ExecutionContext;
}

function makeGuard(metadata: Record<string, unknown> = {}): PasswordChangeGuard {
  return new PasswordChangeGuard({ getAllAndOverride: (key: string) => metadata[key] } as unknown as Reflector);
}

/**
 * PLAN 011 phase 2: a password a sign-in found breached must be changed before
 * the account reaches anything but `/users/me` and Better Auth's own routes.
 */
describe('PasswordChangeGuard', () => {
  it('lets an account through while its password is not marked', () => {
    expect(makeGuard().canActivate(makeContext(makeUser()))).toBe(true);
  });

  it('refuses every other route with 409 PASSWORD_CHANGE_REQUIRED while it is', () => {
    expect(() => makeGuard().canActivate(makeContext(makeUser({ passwordChangeRequired: true })))).toThrow(PasswordChangeRequiredError);
  });

  it('is not the business of a public route', () => {
    expect(makeGuard({ [IS_PUBLIC_KEY]: true }).canActivate(makeContext(makeUser({ passwordChangeRequired: true })))).toBe(true);
  });

  it('lets a marked account reach the routes marked for it', () => {
    const guard = makeGuard({ [ALLOW_PASSWORD_CHANGE_PENDING_KEY]: true });

    expect(guard.canActivate(makeContext(makeUser({ passwordChangeRequired: true })))).toBe(true);
  });

  it('leaves an absent user to the session guard', () => {
    expect(makeGuard().canActivate(makeContext(undefined))).toBe(true);
  });
});

/*
 * The real decorators on the real controllers, read by Nest's own Reflector:
 * the exceptions are exactly GET and DELETE /users/me, plus `/auth/*`.
 */
describe('the routes a marked account still reaches', () => {
  const guard = new PasswordChangeGuard(new Reflector());
  const marked = makeUser({ passwordChangeRequired: true });

  it('GET /users/me — the forced-change screen reads who it is', () => {
    expect(guard.canActivate(makeContext(marked, UsersController.prototype.me, UsersController))).toBe(true);
  });

  it('DELETE /users/me — nobody changes a password to delete their account', () => {
    expect(guard.canActivate(makeContext(marked, UsersController.prototype.remove, UsersController))).toBe(true);
  });

  it('every Better Auth route — /auth/change-password and /auth/sign-out among them — through the public handler', () => {
    expect(guard.canActivate(makeContext(marked, AuthController.prototype.handle, AuthController))).toBe(true);
  });

  it('marks no other route: the decorator appears on those two handlers and on GET /auth/me, and nowhere else', () => {
    const sources = readdirSync(join(SRC, 'modules'), { recursive: true, withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts'))
      .map(entry => join(entry.parentPath, entry.name));
    const uses = sources.flatMap(path =>
      (readFileSync(path, 'utf8').match(/@AllowPasswordChangePending\(\)/g) ?? []).map(() => path.slice(SRC.length + 1))
    );

    expect(sources.length).toBeGreaterThan(20);
    expect(uses.sort()).toEqual([
      'modules/auth/controllers/Auth.controller.ts',
      'modules/users/controllers/Users.controller.ts',
      'modules/users/controllers/Users.controller.ts'
    ]);
  });
});

/*
 * Precedence, in the order `GLOBAL_GUARDS` really runs the three: the address
 * and the owner's lock first, then the password, then the unfinished profile.
 */
describe('the order of the three account-state refusals', () => {
  function chain(metadata: Record<string, unknown>): CanActivate[] {
    const reflector = { getAllAndOverride: (key: string) => metadata[key] } as unknown as Reflector;
    const instances = new Map<Type<CanActivate>, CanActivate>([
      [VerifiedEmailGuard, new VerifiedEmailGuard(reflector)],
      [PasswordChangeGuard, new PasswordChangeGuard(reflector)],
      [RequiresOnboardingGuard, new RequiresOnboardingGuard(reflector)]
    ]);

    return GLOBAL_GUARDS.map(guard => instances.get(guard)).filter(guard => guard !== undefined);
  }

  async function run(user: SessionUser): Promise<unknown> {
    try {
      for (const guard of chain({ [REQUIRES_ONBOARDING_KEY]: true })) {
        await guard.canActivate(makeContext(user));
      }

      return 'through';
    } catch (error: unknown) {
      return error;
    }
  }

  it('says EMAIL_NOT_VERIFIED before PASSWORD_CHANGE_REQUIRED', async () => {
    await expect(run(makeUser({ emailVerified: false, passwordChangeRequired: true }))).resolves.toBeInstanceOf(EmailNotVerifiedError);
  });

  it('says PASSWORD_CHANGE_REQUIRED before ONBOARDING_INCOMPLETE', async () => {
    const getState = jest.spyOn(OnboardingController, 'getState').mockResolvedValue({ isComplete: false, missingSteps: ['goal'] } as never);

    await expect(run(makeUser({ passwordChangeRequired: true }))).resolves.toBeInstanceOf(PasswordChangeRequiredError);
    expect(getState).not.toHaveBeenCalled();

    await expect(run(makeUser())).resolves.toBeInstanceOf(OnboardingIncompleteError);
    getState.mockRestore();
  });
});
