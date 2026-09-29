import { AdminConsentRepository } from '#repositories/Admin';
import { CARE_CONSENT_VERSION } from 'core/entities/Care';
import { HEALTH_CONSENT_VERSION } from 'core/entities/Health';
import { PROFESSIONAL_AGREEMENT_VERSION } from 'core/entities/Professional';
import { PROFILE_CONSENT_VERSION } from 'core/entities/Profile';
import { TERMS_VERSION } from 'core/entities/User';

import type { ConsentVersionRow } from '#repositories/Admin';

/** The consents that carry a version, in the order the page lists them. */
export const CONSENT_KEYS = ['profile', 'health', 'care', 'professional', 'terms'] as const;

export type ConsentKey = (typeof CONSENT_KEYS)[number];

/** One versioned consent: what is current and how many accounts hold each version. */
export type ConsentView = {
  /** Accounts holding the current version. */
  readonly current: number;
  /** The version in force today. */
  readonly currentVersion: string;
  readonly key: ConsentKey;
  /** Accounts holding an older version: the ones who will be asked again. */
  readonly older: number;
  /** Every version held and by how many, the current first, then newest string first. `null` is a grant not yet accepted (`professional`) or an account created before its terms were recorded (`terms`); it is never counted as older. */
  readonly versions: readonly { readonly n: number; readonly version: string | null }[];
};

/**
 * Consentimientos (`GET /admin/consents`, `0071`): for each versioned consent,
 * the version in force and how many accounts hold it or an older one. Numbers
 * only — no account, no date and no value of anybody's (`0028`).
 */
export type AdminConsentsView = {
  readonly consents: readonly ConsentView[];
  /** `profile` against the accounts that finished onboarding: `holding` of `onboarded` hold today's version. */
  readonly onboarded: { readonly holding: number; readonly total: number };
};

function present(key: ConsentKey, currentVersion: string, rows: readonly ConsentVersionRow[]): ConsentView {
  const versions = rows
    .map(row => ({ n: row.n, version: row.version }))
    .sort((a, b) => Number(b.version === currentVersion) - Number(a.version === currentVersion) || (b.version ?? '').localeCompare(a.version ?? ''));

  return {
    current: rows.filter(row => row.version === currentVersion).reduce((sum, row) => sum + row.n, 0),
    currentVersion,
    key,
    older: rows.filter(row => row.version !== null && row.version !== currentVersion).reduce((sum, row) => sum + row.n, 0),
    versions
  };
}

export const AdminConsentController = {
  async consents(): Promise<AdminConsentsView> {
    const [profile, health, care, professional, terms, onboarded] = await Promise.all([
      AdminConsentRepository.profileVersions(),
      AdminConsentRepository.healthVersions(),
      AdminConsentRepository.careVersions(),
      AdminConsentRepository.professionalVersions(),
      AdminConsentRepository.termsVersions(),
      AdminConsentRepository.onboardedAgainstProfileConsent(PROFILE_CONSENT_VERSION)
    ]);

    return {
      consents: [
        present('profile', PROFILE_CONSENT_VERSION, profile),
        present('health', HEALTH_CONSENT_VERSION, health),
        present('care', CARE_CONSENT_VERSION, care),
        present('professional', PROFESSIONAL_AGREEMENT_VERSION, professional),
        present('terms', TERMS_VERSION, terms)
      ],
      onboarded: { holding: onboarded.holding, total: onboarded.onboarded }
    };
  }
};
