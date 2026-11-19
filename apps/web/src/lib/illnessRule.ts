import type { CareEndedLinkView, CareLinkView } from 'core/controllers/Care';

/**
 * Whom the health screen warns about before a declaration is saved
 * (`docs/legal/textos/05` § G.1, PLAN 025 phase 5 step 6): the practitioner of
 * the person's open link, when they hold no NutrIA badge now — saving a
 * condition or a medication ends that link (`0111` § 8).
 *
 * Null with no link, with a verified practitioner, and when the care read
 * failed (`serverApi` answers null): the screen works without it, and only a
 * `false` the API said out loud draws the warning.
 */
export function unverifiedProfessional(link: Pick<CareLinkView, 'professionalName' | 'professionalVerified'> | null | undefined): string | null {
  return link && link.professionalVerified === false ? link.professionalName : null;
}

/**
 * Which § G.3 sentence explains why the illness rule ended the person's latest link
 * (`GET /care/links/me/ended`): a declaration they saved, or the practitioner's badge lost
 * to the daily sweep.
 */
export function illnessEndedBody({ reason }: Pick<CareEndedLinkView, 'reason'>): 'illnessEndedBadgeBody' | 'illnessEndedBody' {
  return reason === 'declared' ? 'illnessEndedBody' : 'illnessEndedBadgeBody';
}
