import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PROFILE_CONSENT_VERSION } from 'core/entities/Profile';
import { ProfileConsentRequiredError } from 'core/entities/Error';

import { hasProfileConsent, PROFILE_CONSENT_STEPS, ProfileConsentController, requireProfileConsent } from './ProfileConsentController';

import type { OnboardingStep } from 'core/entities/Onboarding';

const find = vi.fn<(userId: string) => Promise<{ grantedAt: Date; version: string } | undefined>>();
const give = vi.fn<(userId: string, version: string) => Promise<{ grantedAt: Date; version: string }>>();
const withdraw = vi.fn<(userId: string, reopen: readonly OnboardingStep[], resumeAt: number) => Promise<void>>();

vi.mock('#repositories/Profile', () => ({
  ProfileConsentRepository: {
    find: (userId: string) => find(userId),
    give: (userId: string, version: string) => give(userId, version),
    withdraw: (userId: string, reopen: readonly OnboardingStep[], resumeAt: number) => withdraw(userId, reopen, resumeAt)
  }
}));

const GRANTED = new Date('2026-09-25T10:00:00.000Z');

beforeEach(() => {
  for (const mock of [find, give, withdraw]) {
    mock.mockReset();
  }
});

describe('ProfileConsentController', () => {
  it('presents a stored consent to the current notice as current, with its moment', async () => {
    find.mockResolvedValue({ grantedAt: GRANTED, version: PROFILE_CONSENT_VERSION });

    await expect(ProfileConsentController.get('usr-1')).resolves.toEqual({
      currentVersion: PROFILE_CONSENT_VERSION,
      grantedAt: GRANTED.toISOString(),
      isCurrent: true
    });
    expect(find).toHaveBeenCalledWith('usr-1');
  });

  it('presents a consent to an older notice as not current', async () => {
    find.mockResolvedValue({ grantedAt: GRANTED, version: '0.1.0' });

    await expect(ProfileConsentController.get('usr-1')).resolves.toMatchObject({ isCurrent: false });
  });

  it('presents no consent as not current, with no moment', async () => {
    find.mockResolvedValue(undefined);

    await expect(ProfileConsentController.get('usr-1')).resolves.toEqual({
      currentVersion: PROFILE_CONSENT_VERSION,
      grantedAt: null,
      isCurrent: false
    });
  });

  it('stores the version given, for the session’s own account', async () => {
    give.mockResolvedValue({ grantedAt: GRANTED, version: PROFILE_CONSENT_VERSION });

    await expect(ProfileConsentController.give('usr-1', PROFILE_CONSENT_VERSION)).resolves.toMatchObject({ isCurrent: true });
    expect(give).toHaveBeenCalledWith('usr-1', PROFILE_CONSENT_VERSION);
  });

  it('withdraws by deleting the covered data and reopening the steps that collect it, from the goal on', async () => {
    await expect(ProfileConsentController.withdraw('usr-1')).resolves.toMatchObject({ grantedAt: null, isCurrent: false });
    expect(withdraw).toHaveBeenCalledWith('usr-1', ['goal', 'body-activity', 'allergies'], 2);
  });

  it('covers exactly the steps that collect allergies, intolerances, weight, height, goal and way of eating', () => {
    expect(PROFILE_CONSENT_STEPS).toEqual(['goal', 'body-activity', 'allergies']);
  });
});

describe('requireProfileConsent', () => {
  it('lets a current consent through', async () => {
    find.mockResolvedValue({ grantedAt: GRANTED, version: PROFILE_CONSENT_VERSION });

    await expect(requireProfileConsent('usr-1')).resolves.toBeUndefined();
    await expect(hasProfileConsent('usr-1')).resolves.toBe(true);
  });

  it.each([
    ['absent', undefined],
    ['to an older notice', { grantedAt: GRANTED, version: '0.1.0' }]
  ])('refuses a consent that is %s', async (_label, stored) => {
    find.mockResolvedValue(stored);

    await expect(requireProfileConsent('usr-1')).rejects.toBeInstanceOf(ProfileConsentRequiredError);
  });
});
