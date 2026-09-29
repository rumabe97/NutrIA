import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminConsentController } from './AdminConsentController';

const repository = vi.hoisted(() => ({
  careVersions: vi.fn(),
  healthVersions: vi.fn(),
  onboardedAgainstProfileConsent: vi.fn(),
  professionalVersions: vi.fn(),
  profileVersions: vi.fn()
}));

vi.mock('#repositories/Admin', () => ({ AdminConsentRepository: repository }));

beforeEach(() => {
  vi.resetAllMocks();
  repository.careVersions.mockResolvedValue([]);
  repository.healthVersions.mockResolvedValue([]);
  repository.onboardedAgainstProfileConsent.mockResolvedValue({ holding: 0, onboarded: 0 });
  repository.professionalVersions.mockResolvedValue([]);
  repository.profileVersions.mockResolvedValue([]);
});

describe('AdminConsentController.consents', () => {
  it('lists the four versioned consents in order, each with the version in force', async () => {
    const view = await AdminConsentController.consents();

    expect(view.consents.map(consent => [consent.key, consent.current, consent.older])).toEqual([
      ['profile', 0, 0],
      ['health', 0, 0],
      ['care', 0, 0],
      ['professional', 0, 0]
    ]);
    expect(view.consents.every(consent => /^\d+\.\d+\.\d+$/.test(consent.currentVersion))).toBe(true);
  });

  it('counts who holds the current version, who holds an older one and who has not accepted', async () => {
    const [first] = (await AdminConsentController.consents()).consents;

    repository.profileVersions.mockResolvedValue([
      { n: 2, version: '0.9.0' },
      { n: 7, version: first?.currentVersion },
      { n: 1, version: '0.1.0' }
    ]);
    repository.professionalVersions.mockResolvedValue([
      { n: 3, version: null },
      { n: 1, version: '0.5.0' }
    ]);

    const view = await AdminConsentController.consents();
    const profile = view.consents.find(consent => consent.key === 'profile');
    const professional = view.consents.find(consent => consent.key === 'professional');

    expect(profile).toMatchObject({ current: 7, older: 3 });
    expect(profile?.versions.map(version => version.n)).toEqual([7, 2, 1]);
    expect(professional).toMatchObject({ current: 0, older: 1 });
    expect(professional?.versions).toContainEqual({ n: 3, version: null });
  });

  it('sets the profile consent against onboarded accounts and answers nothing else', async () => {
    repository.onboardedAgainstProfileConsent.mockResolvedValue({ holding: 40, onboarded: 45 });

    const view = await AdminConsentController.consents();

    expect(view.onboarded).toEqual({ holding: 40, total: 45 });
    expect(Object.keys(view).sort()).toEqual(['consents', 'onboarded']);
  });
});
