import styles from './AdminPageHeader.module.css';

import { Text } from 'ui/components/Text';

import type { ReactNode } from 'react';

interface AdminPageHeaderProps {
  /** What sits beside the title on a wide screen and under it on a phone: the period selector. */
  children?: ReactNode;
  /** One line under the title: what the page is for. */
  intro: string;
  title: string;
}

/**
 * A console page's title, its one-line description and its controls (`0068`).
 * Long explanations do not go here: they are on demand, in `HowCounted`.
 */
export function AdminPageHeader({ children, intro, title }: AdminPageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.words}>
        <h1 className={styles.title}>{title}</h1>
        <Text className={styles.intro} tone="secondary">
          {intro}
        </Text>
      </div>
      {children}
    </header>
  );
}
