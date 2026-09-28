import { notFound, redirect } from 'next/navigation';

import { serverApi } from 'lib/server-api';

// Relative, so the unit test can load it: vitest here does not read the tsconfig paths.
import { tableHref } from '../../../components/AdminTable/tableQuery';

import type { PageQuery } from 'components/PeriodSelector';
import type { UserView } from 'core/controllers/User';

/**
 * Resumen's one redirect: the mailed activation link lands on `/admin?abierta=…` (the
 * API's `GET /admin/activate` keeps sending it there) and the banner that says which
 * account was opened lives on Cuentas, so a request carrying `abierta` goes on to
 * `/admin/cuentas` with every parameter kept. Without it, this does nothing.
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
