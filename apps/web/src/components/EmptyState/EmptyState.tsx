import styles from './EmptyState.module.css';

import { Text } from 'ui/components/Text';

import { Card } from 'components/Card';

import type { ReactNode } from 'react';

interface EmptyStateProps {
  body: string;
  children?: ReactNode;
  /**
   * One card among others rather than the whole screen.
   *
   * `/inicio` is the only screen that renders this inside a column — the day's
   * card below it, the rail beside it — and there the screen-sized treatment is
   * wrong: a 24 px centred title inside the roomy padding is half again the
   * size of the card names around it, and on a 320 px screen those centred
   * lines run from edge to edge inside the card. Everywhere else this component
   * *is* the screen, which is what it is dressed for.
   */
  inline?: boolean;
  title: string;
  /** Marks a state that is a problem rather than simply "nothing here yet". */
  tone?: 'neutral' | 'warning';
}

/**
 * Every empty state says what happened and what to do next. A blank panel that
 * only says "no hay nada" leaves the user to guess whether they are early, lost,
 * or looking at a bug.
 */
export function EmptyState({ body, children, inline = false, title, tone = 'neutral' }: EmptyStateProps) {
  const className = [styles.empty, inline ? styles.inline : undefined, tone === 'warning' ? styles.warning : undefined].filter(Boolean).join(' ');

  return (
    <Card as="section" className={className} padding={inline ? 'default' : 'lg'}>
      <h2 className={styles.title}>{title}</h2>
      <Text className={styles.body} tone="secondary">
        {body}
      </Text>
      {children ? <div className={styles.actions}>{children}</div> : null}
    </Card>
  );
}
