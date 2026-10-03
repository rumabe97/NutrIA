import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SignInBrakeController } from './SignInBrakeController';

import type { BrakeDecision, SignInAttempts } from 'core/domain/SignInBrake';

const attempt = vi.fn<(key: string, now: Date, decide: (attempts: SignInAttempts) => BrakeDecision) => Promise<BrakeDecision>>();
const clear = vi.fn<(key: string) => Promise<void>>();
const forgetQuiet = vi.fn<(cutoff: Date) => Promise<number>>();

vi.mock('#repositories/SignInBrake', () => ({
  SignInBrakeRepository: {
    attempt: (key: string, now: Date, decide: (attempts: SignInAttempts) => BrakeDecision) => attempt(key, now, decide),
    clear: (key: string) => clear(key),
    forgetQuiet: (cutoff: Date) => forgetQuiet(cutoff)
  }
}));

const KEY = 'k'.repeat(64);
const NOW = new Date('2026-10-03T10:00:00.000Z');

beforeEach(() => {
  attempt.mockReset();
  clear.mockReset();
  forgetQuiet.mockReset();
});

describe('SignInBrakeController.attempt', () => {
  it('decides under the repository lock with the domain rule, at the same instant', async () => {
    attempt.mockImplementation(async (_key, _now, decide) => Promise.resolve(decide({ count: 9, nextAllowedAt: null, windowStartedAt: NOW })));

    await expect(SignInBrakeController.attempt(KEY, NOW)).resolves.toEqual({
      kind: 'allowed',
      next: { count: 10, nextAllowedAt: new Date('2026-10-03T10:00:30.000Z'), windowStartedAt: NOW }
    });
    expect(attempt).toHaveBeenCalledWith(KEY, NOW, expect.any(Function));
  });
});

describe('SignInBrakeController.signedIn', () => {
  it('clears the key', async () => {
    await SignInBrakeController.signedIn(KEY);

    expect(clear).toHaveBeenCalledWith(KEY);
  });
});

describe('SignInBrakeController.forgetQuiet', () => {
  it('forgets rows a day quiet', async () => {
    forgetQuiet.mockResolvedValue(3);

    await expect(SignInBrakeController.forgetQuiet(NOW)).resolves.toBe(3);
    expect(forgetQuiet).toHaveBeenCalledWith(new Date('2026-10-02T10:00:00.000Z'));
  });
});
