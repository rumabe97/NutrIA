import { SetMetadata } from '@nestjs/common';

export const BEFORE_PRACTICE_KEY = 'beforePractice';

/**
 * Opens a workspace route to a professional whose practice is not paid for
 * (`0061`), or who has not yet accepted the current agreement
 * (`docs/legal/textos/01`). `ProfessionalGuard` asks for both on every route by
 * default, so the exceptions — the workspace's own page, where the agreement
 * and the way to pay are shown, and accepting the agreement — are an explicit,
 * greppable decision, and a client route that forgets something is closed
 * rather than open.
 */
export function BeforePractice(): MethodDecorator & ClassDecorator {
  return SetMetadata(BEFORE_PRACTICE_KEY, true);
}
