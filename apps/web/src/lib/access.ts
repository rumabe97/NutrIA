import { redirect } from 'next/navigation';

import { serverApi } from './server-api';

import type { UserView } from 'core/controllers/User';

/**
 * Only an activated account may use the product (0017). The API refuses
 * everything else anyway; this sends the person to the page that says so
 * instead of leaving them on a screen of empty states.
 */
export async function redirectIfUnverified(): Promise<void> {
  const user = await serverApi<UserView>('/users/me');

  if (user && !user.emailVerified) {redirect('/pendiente');}
}
