import styles from './EmptyState.module.css';

import { Text } from 'ui/components/Text';

import type { ReactNode } from 'react';

interface EmptyStateProps {
  body: string;
  children?: ReactNode;
  title: string;
  /** Marks a state that is a problem rather than simply "nothing here yet". */
  tone?: 'neutral' | 'warning';
}

/**
 * Every empty state says what happened and what to do next. A blank panel that
 * only says "no hay nada" leaves the user to guess whether they are early, lost,
 * or looking at a bug.
 */
export function EmptyState({ body, children, title, tone = 'neutral' }: EmptyStateProps) {
  return (
    <section className={tone === 'warning' ? `${styles.empty} ${styles.warning}` : styles.empty}>
      <h2 className={styles.title}>{title}</h2>
      <Text className={styles.body} tone="secondary">
        {body}
      </Text>
      {children ? <div className={styles.actions}>{children}</div> : null}
    </section>
  );
}
