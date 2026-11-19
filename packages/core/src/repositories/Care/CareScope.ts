import type { CareConsentScope } from 'core/entities/Care';

/**
 * How much of a client a link opens **now** (`0111` § 4): `full` only while
 * the practitioner holds the badge (`ProfessionalBadgeRepository.badgeOf`, read
 * on the request, cached nowhere) **and** the client consented to the badged
 * list (`care_links.consent_scope`); `plan` otherwise. A badge gained mid-link
 * widens nothing until the client consents again; a badge lost narrows on the
 * next request.
 *
 * The one definition: `CareRepository.activeLink`, `CareRepository.roster` and
 * `CareController.activeProfessional` all call it. Pure, and in a file of its
 * own so a test of a caller can use the real rule while it stubs the queries.
 */
export function linkScope(consentScope: CareConsentScope, badged: boolean): CareConsentScope {
  return badged && consentScope === 'full' ? 'full' : 'plan';
}
