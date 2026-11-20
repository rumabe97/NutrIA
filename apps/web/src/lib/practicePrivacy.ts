import { withLocale } from 'i18n/routes';

import type { Locale } from 'i18n/config';

/**
 * Where a care sentence's `{privacy}` points: the policy's section about working
 * with a professional, `#tu-profesional` (`docs/legal/2026-11-18-anyone-can-open-a-practice.md`
 * § 4, P-3). The section's old anchor, `#tu-dietista`, still lands on it (`formerIds`), for
 * the links already sent.
 */
export function practicePrivacyHref(locale: Locale): string {
  return withLocale('/privacidad#tu-profesional', locale);
}
