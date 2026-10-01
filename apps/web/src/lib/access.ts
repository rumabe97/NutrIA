import { redirect } from 'next/navigation';

import { PASSWORD_CHANGE_PATH } from './api';
import { serverApi } from './server-api';

import type { UserView } from 'core/controllers/User';

/**
 * The product is usable when both locks are open: the address is confirmed and
 * the owner has opened the account (0017, 0030, 0031).
 *
 * Both, because they are undone by different people and only the API knows
 * which is missing. Asking for one alone is what let somebody who had clicked
 * their confirmation link walk into the app shell and see a dashboard of empty
 * states — `serverApi` turns the API's 409 into null, so every section degrades
 * quietly instead of saying no.
 *
 * It is a redirect, not an authorisation check — the enforcement is
 * `VerifiedEmailGuard` in the API. Which is why it only acts on a state it
 * positively read: a null means the API could not be asked, and bouncing a
 * signed-in person to the waiting room on a hiccup is its own bug.
 */
export async function redirectUnlessReady(): Promise<void> {
  const user = await serverApi<UserView>('/users/me');

  if (user && (!user.activated || !user.emailVerified)) {
    redirect('/pendiente');
  }

  // Second, after the locks and before onboarding — the API's own order (project 011): a
  // password found in a breach answers 409 on every route but `/users/me`, so nothing past
  // this point could load. The screen it sends to is outside this tree and repeats both
  // checks, so neither redirect can bounce back here.
  if (user?.passwordChangeRequired) {
    redirect(PASSWORD_CHANGE_PATH);
  }
}
