import { useId } from 'react';

import styles from './AdminTextArea.module.css';

import { Label } from 'ui/components/Label';

import type { ComponentPropsWithRef } from 'react';

interface AdminTextAreaProps extends Omit<ComponentPropsWithRef<'textarea'>, 'aria-describedby' | 'id'> {
  /** What is wrong with the box, in words the owner can act on; replaces the hint. */
  error?: string;
  /** What to write in it. */
  hint?: string;
  /** **Required.** The visible label. */
  label: string;
}

/**
 * A box for the owner's own words in a statement of reasons (project 025 phase 9):
 * a visible label, a hint tied to the box and, when the form refuses it, the error
 * in its place with `aria-invalid`. The owner writes in Spanish, so the box says so
 * (`lang="es"`), and a screen reader on the English console reads what he types as
 * Spanish. `ui/components/Input` is one line; this is the paragraph.
 */
export function AdminTextArea({ className, error, hint, label, ...rest }: AdminTextAreaProps) {
  const id = useId();
  const hintId = hint && !error ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={className ? `${styles.root} ${className}` : styles.root}>
      <Label className={styles.label} htmlFor={id}>
        {label}
      </Label>
      <textarea
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        aria-invalid={error ? true : undefined}
        className={error ? `${styles.box} ${styles.invalid}` : styles.box}
        id={id}
        lang="es"
        rows={4}
        {...rest}
      />
      {hint && !error ? (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p aria-live="polite" className={styles.error} id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
