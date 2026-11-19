import { withLocale } from 'i18n/routes';

import type { Locale } from 'i18n/config';

/**
 * Where a care sentence's `{privacy}` points: the policy's section about working
 * with a professional. Its anchor is still `#tu-dietista` — the section is
 * renamed `#tu-profesional` with the policy's new text in project 025 phase 10
 * (`docs/legal/2026-11-18-anyone-can-open-a-practice.md` § 4, P-3), and this is
 * the one line that changes with it.
 */
export function practicePrivacyHref(locale: Locale): string {
  return withLocale('/privacidad#tu-dietista', locale);
}
