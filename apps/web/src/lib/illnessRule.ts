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
 * Why the illness rule ended the person's latest link: a declaration they saved, or the
 * practitioner's badge lost by the daily sweep. **Local until core ships it**: the invariant
 * review moves `reason` onto `CareEndedLinkView` (`GET /care/links/me/ended`); once it is there,
 * this type is that view and the optional mark goes.
 */
export type IllnessEnding = CareEndedLinkView & { reason?: 'badge_lost' | 'declared' };

/**
 * Which § G.3 sentence explains the ending: the declaration's, or the badge's. An answer with
 * no `reason` comes from the API before that review, which only ever reported the sweep.
 */
export function illnessEndedBody(ending: Pick<IllnessEnding, 'reason'>): 'illnessEndedBadgeBody' | 'illnessEndedBody' {
  return ending.reason === 'declared' ? 'illnessEndedBody' : 'illnessEndedBadgeBody';
}
