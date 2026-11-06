import { notFound, redirect } from 'next/navigation';

import { serverApi } from 'lib/server-api';

// Relative, so the unit test can load it: vitest here does not read the tsconfig paths.
import { tableHref } from '../../../components/AdminTable/tableQuery';

import type { PageQuery } from 'components/PeriodSelector';
import type { UserView } from 'core/controllers/User';

/**
 * Resumen's one redirect: a request carrying `abierta` goes on to `/admin/cuentas`
 * with every parameter kept, because the banner that says which account was opened
 * lives there. Without it, this does nothing.
 *
 * **Nothing sends that parameter any more.** It arrived from the mailed activation
 * link through the API's `GET /admin/activate`, which was removed on 2026-11-06 once
 * every token it could honour had expired. This and the banner it forwards to are
 * now reachable only by typing the parameter by hand; removing the pair is a
 * separate, web-side change, and the gate cannot see it because the page still
 * calls this.
 *
 * The gate's question is asked here again, first. The console's layout and its page
 * render at the same time, so the layout's 404 is not guaranteed to land before this
 * redirect — and a redirect answered to somebody who is not an admin would confirm
 * that the address exists (`0028`, `0068`).
 */
export async function forwardOpened(query: PageQuery): Promise<void> {
  if (query.abierta === undefined) {
    return;
  }

  const user = await serverApi<UserView>('/users/me');

  if (user?.role !== 'admin') {
    notFound();
  }

  redirect(tableHref('/admin/cuentas', query, {}));
}
