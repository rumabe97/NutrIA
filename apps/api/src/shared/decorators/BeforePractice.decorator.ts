import { SetMetadata } from '@nestjs/common';

export const BEFORE_PRACTICE_KEY = 'beforePractice';

/**
 * Opens a workspace route to a professional whose practice is not paid for
 * (`0061`). `ProfessionalGuard` asks for a practice paid for on every route by
 * default, so the one exception — the workspace's own page, where the way to
 * pay is shown — is an explicit, greppable decision, and a client route that
 * forgets something is closed rather than open.
 */
export function BeforePractice(): MethodDecorator & ClassDecorator {
  return SetMetadata(BEFORE_PRACTICE_KEY, true);
}
