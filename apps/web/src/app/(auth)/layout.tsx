import Link from 'next/link';

import styles from './layout.module.css';

import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <div className={styles.card}>
        <Link aria-label="NutrIA — inicio" className={styles.brand} href="/">
          <span aria-hidden="true" className={styles.mark} />
          NutrIA
        </Link>
        {children}
      </div>
    </div>
  );
}
