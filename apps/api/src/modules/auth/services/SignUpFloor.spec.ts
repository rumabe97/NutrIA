import { describe, expect, it, jest } from '@jest/globals';

import { SIGN_UP_FLOOR_MS, signUpFloor } from './SignUpFloor.js';

import type { Context } from './PasswordPolicy.js';

/** A hook's context for `path`; `withRequest: false` is a call through `auth.api`, which has none. */
function contextFor(path: string, withRequest = true): Context {
  return { path, request: withRequest ? new Request('http://localhost/api/v1/auth/sign-up/email') : undefined } as unknown as Context;
}

describe('signUpFloor', () => {
  it('holds a sign-up for what is left of the floor, counted from the start', async () => {
    let clock = 1000;
    const wait = jest.fn(async (_ms: number) => Promise.resolve());
    const floor = signUpFloor(SIGN_UP_FLOOR_MS, () => clock, wait);
    const context = contextFor('/sign-up/email');

    floor.start(context);
    clock += 120;
    await floor.hold(context);

    expect(wait).toHaveBeenCalledWith(SIGN_UP_FLOOR_MS - 120);
  });

  it('adds nothing once the floor has passed, and holds a request once', async () => {
    let clock = 0;
    const wait = jest.fn(async (_ms: number) => Promise.resolve());
    const floor = signUpFloor(SIGN_UP_FLOOR_MS, () => clock, wait);
    const context = contextFor('/sign-up/email');

    floor.start(context);
    clock += SIGN_UP_FLOOR_MS + 1;
    await floor.hold(context);
    await floor.hold(context);

    expect(wait).not.toHaveBeenCalled();
  });

  it('touches no other route, no call without a request, and no sign-up refused before the clock started', async () => {
    const wait = jest.fn(async (_ms: number) => Promise.resolve());
    const floor = signUpFloor(SIGN_UP_FLOOR_MS, () => 0, wait);

    for (const context of [contextFor('/sign-in/email'), contextFor('/sign-up/email', false)]) {
      floor.start(context);
      await floor.hold(context);
    }

    await floor.hold(contextFor('/sign-up/email'));

    expect(wait).not.toHaveBeenCalled();
  });
});
