import { notFound, redirect } from 'next/navigation';

import { serverApi } from 'lib/server-api';

import type { UserView } from 'core/controllers/User';

/**
 * `/admin`, until Resumen exists (phase 4 of project 007 replaces this file).
 *
 * Everything the console had still sits on the transition page, so this sends
 * the owner there — with the query string, because the mailed activation link
 * lands here as `/admin?abierta=…` and the transition page is what says which
 * account was just opened.
 *
 * It asks the gate's question again: a layout and its page render at the same
 * time, so the layout's 404 is not guaranteed to land before this redirect, and
 * a redirect would tell a stranger the address is something.
 */
export default async function AdminIndex({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await serverApi<UserView>('/users/me');

  if (user?.role !== 'admin') {
    notFound();
  }

  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(await searchParams)) {
    for (const one of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      query.append(key, one);
    }
  }

  const search = query.toString();

  redirect(search ? `/admin/anterior?${search}` : '/admin/anterior');
}
