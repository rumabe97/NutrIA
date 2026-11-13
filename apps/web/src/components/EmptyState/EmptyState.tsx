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
  /**
   * `1` when the empty state is the page — its title is then the page's one `h1`, the
   * heading a screen reader lands on and lists first. `2` (the default) where the page
   * already has its title above it: a card among others, a section of a console page.
   */
  level?: 1 | 2;
  title: string;
  /** Marks a state that is a problem rather than simply "nothing here yet". */
  tone?: 'neutral' | 'warning';
}

/**
 * Every empty state says what happened and what to do next. A blank panel that
 * only says "no hay nada" leaves the user to guess whether they are early, lost,
 * or looking at a bug.
 */
export function EmptyState({ body, children, inline = false, level = 2, title, tone = 'neutral' }: EmptyStateProps) {
  const Heading = level === 1 ? 'h1' : 'h2';
  const className = [styles.empty, inline ? styles.inline : undefined, tone === 'warning' ? styles.warning : undefined].filter(Boolean).join(' ');

  return (
    <Card as="section" className={className} padding={inline ? 'default' : 'lg'}>
      <Heading className={styles.title}>{title}</Heading>
      <Text className={styles.body} tone="secondary">
        {body}
      </Text>
      {children ? <div className={styles.actions}>{children}</div> : null}
    </Card>
  );
}
