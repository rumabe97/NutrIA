import styles from './layout.module.css';

import { AppNav } from 'components/AppNav';

import type { ReactNode } from 'react';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <AppNav />
      <main className={styles.content}>{children}</main>
    </div>
  );
}
