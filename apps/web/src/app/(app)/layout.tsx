import styles from './layout.module.css';

import { AppNav } from 'components/AppNav';

import { redirectIfUnverified } from 'lib/access';

import type { ReactNode } from 'react';

export default async function AppLayout({ children }: { children: ReactNode }) {
  await redirectIfUnverified();

  return (
    <div className={styles.shell}>
      <AppNav />
      <main className={styles.content}>{children}</main>
    </div>
  );
}
