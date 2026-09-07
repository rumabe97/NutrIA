import type { OnboardingStep } from 'core/entities/Onboarding';

/**
 * The eight data steps plus a review screen, in order.
 *
 * `core/entities/Onboarding` declares ten (the tenth is plan generation, which
 * arrives with the meal-engine project). Here we render nine, and the review
 * step closes onboarding — so the flow never shows a step whose action does not
 * yet exist.
 *
 * Only keys. The title and subtitle live in the dictionaries, because a step
 * list that carries its own Spanish is a step list that cannot be translated.
 * `key` is what the API's discriminated union expects, and keeping the ordering
 * in one array is what keeps the progress bar, the URL and the server's
 * completeness check in agreement.
 */
export const FLOW = [
  { copy: 'aboutYou', key: 'about-you' },
  { copy: 'goal', key: 'goal' },
  { copy: 'bodyActivity', key: 'body-activity' },
  { copy: 'howYouEat', key: 'how-you-eat' },
  { copy: 'foodPreferences', key: 'food-preferences' },
  { copy: 'allergies', key: 'allergies' },
  { copy: 'lifestyle', key: 'lifestyle' },
  { copy: 'cooking', key: 'cooking' },
  { copy: 'review', key: 'review' }
] as const satisfies readonly { copy: string; key: 'review' | OnboardingStep }[];

export const TOTAL_STEPS = FLOW.length;
