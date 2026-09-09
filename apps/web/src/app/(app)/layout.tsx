import styles from './layout.module.css';

import { AppNav } from 'components/AppNav';

import { redirectIfNotActivated } from 'lib/access';

import type { ReactNode } from 'react';

export default async function AppLayout({ children }: { children: ReactNode }) {
  await redirectIfNotActivated();

  return (
    <div className={styles.shell}>
      <AppNav />
      <main className={styles.content}>{children}</main>
    </div>
  );
}
