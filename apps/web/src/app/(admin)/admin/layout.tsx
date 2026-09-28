import { notFound } from 'next/navigation';

import styles from './layout.module.css';

import { AdminNav } from 'components/AdminNav';

import { serverApi } from 'lib/server-api';

import { MAIN_ID } from '../../_shared/mainId';

import type { ReactNode } from 'react';
import type { UserView } from 'core/controllers/User';

// Every console page is read per request, for the session: nothing here may be
// prerendered as whoever built it.
export const dynamic = 'force-dynamic';

/**
 * The console's gate and frame.
 *
 * Anyone but an admin gets a 404, on every page under `/admin`, so the console
 * does not confirm itself to somebody who guesses the address (`0028`). This is
 * the page-side mirror of the API's `@Roles('admin')` guard, which stays the
 * real check: every read these pages make is refused there too. `UserView`
 * carries the stored `role`, so one read of `/users/me` answers it; a failed
 * read (no session, an expired one) is a 404 as well.
 *
 * The 404 is drawn by `(admin)/not-found.tsx`, the boundary above this layout —
 * a boundary beside it only wraps its pages, not the layout that throws.
 */
export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  const user = await serverApi<UserView>('/users/me');

  if (user?.role !== 'admin') {
    notFound();
  }

  return (
    <div className={styles.shell}>
      <AdminNav />
      <main className={styles.content} id={MAIN_ID}>
        {children}
      </main>
    </div>
  );
}
