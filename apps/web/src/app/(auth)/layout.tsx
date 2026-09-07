import Link from 'next/link';

import styles from './layout.module.css';

import { LocaleSwitcher } from 'components/LocaleSwitcher';

import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <div className={styles.card}>
        <Link aria-label="NutrIA — inicio" className={styles.brand} href="/">
          <span aria-hidden="true" className={styles.mark} />
          NutrIA
        </Link>
        {/* Signing up in the wrong language is a bad first ten minutes. */}
        <div className={styles.locale}>
          <LocaleSwitcher compact={true} />
        </div>
        {children}
      </div>
    </div>
  );
}
