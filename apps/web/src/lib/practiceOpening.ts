import { serverApi } from './server-api';

import type { PracticeOpeningView } from 'core/controllers/Professional';
import type { UserView } from 'core/controllers/User';

/**
 * What a practice would open with (`GET /care/practice/opening`, PRD 025 scope 1):
 * the places the opening form and the `/perfil` card name (`practice.openIntro`'s
 * `{limit}`), or null when the door is closed or the read failed — and then
 * neither is drawn: never a sentence with a hole in it or a typed number.
 */
export async function practiceOpening(user: UserView | null): Promise<number | null> {
  if (!user?.canOpenPractice) {
    return null;
  }

  const opening = await serverApi<PracticeOpeningView>('/care/practice/opening');

  return typeof opening?.seats === 'number' ? opening.seats : null;
}
