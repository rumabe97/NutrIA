import { useId } from 'react';

import styles from './ActCard.module.css';

import { Card } from 'components/Card';

import type { ReactNode } from 'react';

interface ActCardProps {
  children: ReactNode;
  title: string;
}

/**
 * One of the owner's acts and its form: a card with its own heading, so each act is one
 * decision with one button (project 025 phase 9) and a screen reader can list them.
 */
export function ActCard({ children, title }: ActCardProps) {
  const id = useId();

  return (
    <Card aria-labelledby={id} as="section" className={styles.card}>
      <h2 className={styles.title} id={id}>
        {title}
      </h2>
      {children}
    </Card>
  );
}
