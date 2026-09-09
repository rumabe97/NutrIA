import { redirect } from 'next/navigation';

import { serverApi } from './server-api';

import type { UserView } from 'core/controllers/User';

/**
 * Only an account the owner has opened may use the product (0017).
 *
 * It asks for `activated`, never `emailVerified`: confirming an address proves
 * the address is yours and opens nothing (0030). Reading the wrong one is how
 * somebody who clicked their confirmation link walks into the app shell and
 * sees a dashboard of empty states, because `serverApi` turns the API's 409
 * into null and every section degrades quietly.
 *
 * It is a redirect, not an authorisation check — the enforcement is
 * `VerifiedEmailGuard` in the API. Which is why it only acts on a state it
 * positively read: a null means the API could not be asked, and bouncing a
 * signed-in person to the waiting room on a hiccup is its own bug.
 */
export async function redirectIfNotActivated(): Promise<void> {
  const user = await serverApi<UserView>('/users/me');

  if (user && !user.activated) {redirect('/pendiente');}
}
