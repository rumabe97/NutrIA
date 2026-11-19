import { useId } from 'react';

import styles from './ChoiceSet.module.css';

import type { ReactNode } from 'react';

interface ChoiceSetProps {
  children: ReactNode;
  /** What is wrong with the choice, in words the owner can act on. */
  error?: string;
  /** **Required.** The question the choices answer: it names the group for a screen reader. */
  legend: string;
}

/**
 * A group of choices under one question, each choice a whole approved sentence
 * (project 025 phase 9): a `fieldset` with its `legend`, the items one under the
 * other, and the error under them. Radios and checkboxes sit in it alike.
 */
export function ChoiceSet({ children, error, legend }: ChoiceSetProps) {
  const errorId = useId();

  return (
    <fieldset aria-describedby={error ? errorId : undefined} className={styles.set}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.items}>{children}</div>
      {error ? (
        <p aria-live="polite" className={styles.error} id={errorId}>
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
