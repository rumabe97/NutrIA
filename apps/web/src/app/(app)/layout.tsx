import styles from './layout.module.css';

import { AppNav } from 'components/AppNav';

import { redirectUnlessReady } from 'lib/access';

import type { ReactNode } from 'react';

export default async function AppLayout({ children }: { children: ReactNode }) {
  await redirectUnlessReady();

  return (
    <div className={styles.shell}>
      <AppNav />
      <main className={styles.content}>{children}</main>
    </div>
  );
}
