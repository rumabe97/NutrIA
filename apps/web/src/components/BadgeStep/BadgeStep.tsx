import { useId } from 'react';

import styles from './BadgeStep.module.css';

import { Card } from 'components/Card';

import type { ReactNode } from 'react';

interface BadgeStepProps {
  children: ReactNode;
  /** Its place in the steps: the number the sheet draws in the circle. */
  number: 1 | 2 | 3 | 4;
  title: string;
}

/**
 * One numbered step of a console flow — the three of checking a badge (sheet
 * «ConsolaDistintivo»), the four of the change notice: a card whose heading carries
 * its number in a circle. The number is decoration — the
 * steps are in order in the page, and the heading names the step.
 */
export function BadgeStep({ children, number, title }: BadgeStepProps) {
  const id = useId();

  return (
    <Card aria-labelledby={id} as="section" className={styles.card}>
      <div className={styles.head}>
        <span aria-hidden="true" className={styles.marker}>
          {number}
        </span>
        <h2 className={styles.title} id={id}>
          {title}
        </h2>
      </div>
      {children}
    </Card>
  );
}
