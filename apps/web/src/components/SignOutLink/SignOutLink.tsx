'use client';
import { useRouter } from 'next/navigation';

import styles from './SignOutLink.module.css';

import { signOut } from 'lib/auth-client';

import type { ReactNode } from 'react';

/** Sign out from somewhere without the app's navigation — the pending page. */
export function SignOutLink({ children }: { children: ReactNode }) {
  const router = useRouter();

  async function handle() {
    await signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <button className={styles.link} onClick={() => void handle()} type="button">
      {children}
    </button>
  );
}
