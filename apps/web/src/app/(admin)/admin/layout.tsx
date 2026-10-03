import { notFound } from 'next/navigation';

import styles from './layout.module.css';

import { secondFactorMissing } from 'core/domain/SecondFactor';

import { AdminNav } from 'components/AdminNav';
import { SecondFactorRequired } from 'components/SecondFactorRequired';

import { MAIN_ID } from '../../_shared/mainId';
import { readConsoleUser } from './consoleMetadata';

import type { ReactNode } from 'react';

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
 * An admin who signs in with a password and has not turned on the second
 * factor gets `SecondFactorRequired` instead of the console — the same rule the
 * API's `AdminGuard` applies, read from the same `UserView` (`secondFactorMissing`).
 *
 * The 404 is drawn by `(admin)/not-found.tsx`, the boundary above this layout —
 * a boundary beside it only wraps its pages, not the layout that throws.
 */
export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  const user = await readConsoleUser();

  if (user?.role !== 'admin') {
    notFound();
  }

  // The API refuses every console route to an admin with a password and no second factor
  // (PLAN 011 phase 6); the owner is told what to do instead of a console of empty pages.
  if (secondFactorMissing(user)) {
    return (
      <main className={styles.content} id={MAIN_ID}>
        <SecondFactorRequired where="console" />
      </main>
    );
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
