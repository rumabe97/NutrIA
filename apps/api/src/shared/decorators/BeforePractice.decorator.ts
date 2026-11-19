import { SetMetadata } from '@nestjs/common';

export const BEFORE_PRACTICE_KEY = 'beforePractice';

/**
 * Opens a workspace route to a practitioner who has not yet accepted the
 * current agreement (`docs/legal/textos/01`), has no second factor, or is
 * suspended or closed (PRD 025 criterion 24). `ProfessionalGuard` asks for all
 * of it on every route by default, so the exceptions — the practice's own page,
 * where the agreement and what stands are shown, accepting the agreement, the
 * badge and the profile, none of which names a client — are an explicit,
 * greppable decision, and a client route that forgets something is closed
 * rather than open.
 */
export function BeforePractice(): MethodDecorator & ClassDecorator {
  return SetMetadata(BEFORE_PRACTICE_KEY, true);
}
