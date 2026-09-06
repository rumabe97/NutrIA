import { useId } from 'react';

import styles from './Input.module.css';

import { Label } from 'ui/components/Label';

import type { ComponentPropsWithRef } from 'react';

export interface InputProps extends Omit<ComponentPropsWithRef<'input'>, 'id'> {
  /** Error message in an `aria-live="polite"` region. Prefer on-blur or on-submit validation — debounce live updates (~300ms) to avoid chatter. */
  error?: string;
  /** Helper text linked via `aria-describedby`. Auto-hidden when `error` is set. */
  hint?: string;
  /** **Required.** Visible label linked via `htmlFor`. For visually label-less inputs (e.g. search), pass a visually-hidden node. */
  label: string;
}

export function Input({ className, error, hint, label, ...rest }: InputProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={className ? `${styles.root} ${className}` : styles.root}>
      <Label className={styles.label} htmlFor={id}>
        {label}
      </Label>
      <input
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={error ? `${styles.input} ${styles.invalid}` : styles.input}
        id={id}
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
