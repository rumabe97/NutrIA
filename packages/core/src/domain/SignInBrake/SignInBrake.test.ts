import { describe, expect, it } from 'vitest';

import { decideAttempt, SIGN_IN_BRAKE, signInBrakeKey, waitAfter } from './SignInBrake';

import type { SignInAttempts } from './SignInBrake';

const NOW = new Date('2026-10-03T10:00:00.000Z');
const SECRET = 'a-secret-of-at-least-thirty-two-characters';

function at(offsetMs: number): Date {
  return new Date(NOW.getTime() + offsetMs);
}

/** Runs `n` attempts back to back from nothing, each the moment the last one's wait ends. */
function attempts(n: number): SignInAttempts | undefined {
  let state: SignInAttempts | undefined;
  let clock = NOW;

  for (let i = 0; i < n; i += 1) {
    clock = state?.nextAllowedAt ?? clock;
    const decision = decideAttempt(state, clock);

    if (decision.kind !== 'allowed') {
      throw new Error('braked while walking the waits');
    }

    state = decision.next;
  }

  return state;
}

describe('signInBrakeKey', () => {
  it('is the same for an address however it is cased, as Better Auth looks the account up', () => {
    expect(signInBrakeKey('Ana@Example.invalid', SECRET)).toBe(signInBrakeKey('ana@example.invalid', SECRET));
  });

  it('never holds the address, and changes with the secret', () => {
    const key = signInBrakeKey('ana@example.invalid', SECRET);

    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toContain('ana');
    expect(signInBrakeKey('ana@example.invalid', `${SECRET}-rotated`)).not.toBe(key);
  });

  it('tells two addresses apart', () => {
    expect(signInBrakeKey('ana@example.invalid', SECRET)).not.toBe(signInBrakeKey('ana2@example.invalid', SECRET));
  });
});

describe('waitAfter', () => {
  it('waits nothing below the tenth attempt', () => {
    for (let count = 1; count < SIGN_IN_BRAKE.threshold; count += 1) {
      expect(waitAfter(count)).toBe(0);
    }
  });

  it('waits 30 s after the tenth, then doubles, capped at fifteen minutes', () => {
    expect([10, 11, 12, 13, 14, 15, 16, 50, 5000].map(waitAfter)).toEqual([
      30_000, 60_000, 120_000, 240_000, 480_000, 900_000, 900_000, 900_000, 900_000
    ]);
  });
});

describe('decideAttempt', () => {
  it('counts a first attempt from nothing, with no wait', () => {
    expect(decideAttempt(undefined, NOW)).toEqual({ kind: 'allowed', next: { count: 1, nextAllowedAt: null, windowStartedAt: NOW } });
  });

  it('lets the tenth attempt in a window run and leaves the eleventh waiting 30 s', () => {
    const nine = attempts(9);

    expect(nine).toEqual({ count: 9, nextAllowedAt: null, windowStartedAt: NOW });
    expect(decideAttempt(nine, at(60_000))).toEqual({ kind: 'allowed', next: { count: 10, nextAllowedAt: at(90_000), windowStartedAt: NOW } });
  });

  it('brakes before the wait ends, with the seconds left rounded up and never zero', () => {
    const ten = { count: 10, nextAllowedAt: at(30_000), windowStartedAt: NOW };

    expect(decideAttempt(ten, NOW)).toEqual({ kind: 'braked', retryAfterSeconds: 30 });
    expect(decideAttempt(ten, at(29_001))).toEqual({ kind: 'braked', retryAfterSeconds: 1 });
    expect(decideAttempt(ten, at(29_999))).toEqual({ kind: 'braked', retryAfterSeconds: 1 });
  });

  it('lets the attempt at the end of the wait run, and doubles the next wait', () => {
    const ten = { count: 10, nextAllowedAt: at(30_000), windowStartedAt: NOW };

    expect(decideAttempt(ten, at(30_000))).toEqual({ kind: 'allowed', next: { count: 11, nextAllowedAt: at(90_000), windowStartedAt: NOW } });
  });

  it('never waits longer than fifteen minutes: no hard lock', () => {
    const many = attempts(40);

    expect(many?.count).toBe(40);
    expect(many?.nextAllowedAt).not.toBeNull();

    const decision = decideAttempt(many, new Date((many?.nextAllowedAt?.getTime() ?? 0) - 1));

    expect(decision).toEqual({ kind: 'braked', retryAfterSeconds: 1 });

    const previous = attempts(39);

    expect((many?.nextAllowedAt?.getTime() ?? 0) - (previous?.nextAllowedAt?.getTime() ?? 0)).toBe(SIGN_IN_BRAKE.maxWaitMs);
  });

  it('starts again at one after fifteen quiet minutes from the window start', () => {
    const five = { count: 5, nextAllowedAt: null, windowStartedAt: NOW };

    expect(decideAttempt(five, at(SIGN_IN_BRAKE.windowMs - 1))).toMatchObject({ next: { count: 6, windowStartedAt: NOW } });
    expect(decideAttempt(five, at(SIGN_IN_BRAKE.windowMs))).toEqual({
      kind: 'allowed',
      next: { count: 1, nextAllowedAt: null, windowStartedAt: at(SIGN_IN_BRAKE.windowMs) }
    });
  });

  it('measures the quiet from the end of the last wait, so a patient guesser stays braked', () => {
    // The window began an hour ago; the last wait ended a minute ago.
    const braked = { count: 15, nextAllowedAt: at(-60_000), windowStartedAt: at(-3_600_000) };

    expect(decideAttempt(braked, NOW)).toEqual({
      kind: 'allowed',
      next: { count: 16, nextAllowedAt: at(SIGN_IN_BRAKE.maxWaitMs), windowStartedAt: at(-3_600_000) }
    });
    expect(decideAttempt(braked, at(SIGN_IN_BRAKE.windowMs - 60_000))).toMatchObject({ next: { count: 1 } });
  });
});
