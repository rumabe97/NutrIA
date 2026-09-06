import { useId } from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';

import styles from './Checkbox.module.css';

import { Label } from 'ui/components/Label';

import type { ReactNode } from 'react';

export interface CheckboxProps extends CheckboxPrimitive.CheckboxProps {
  /** **Required.** Label rendered alongside the checkbox — the whole `<label>` is the click target (WCAG 2.5.8). Pass a visually-hidden node for label-less cases. */
  label: ReactNode;
}

export function Checkbox({ className, label, ...rest }: CheckboxProps) {
  const id = useId();
  const checkboxId = rest.id ?? id;
  const wrapperClass = className ? `${styles.wrapper} ${className}` : styles.wrapper;

  return (
    <Label className={wrapperClass} htmlFor={checkboxId}>
      <CheckboxPrimitive.Root className={styles.root} id={checkboxId} {...rest}>
        <CheckboxPrimitive.Indicator className={styles.indicator}>
          <svg aria-hidden={true} className={styles.check} fill="none" height="8" viewBox="0 0 10 8" width="10">
            <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
          </svg>
          <svg aria-hidden={true} className={styles.indeterminate} fill="none" height="2" viewBox="0 0 10 2" width="10">
            <line stroke="currentColor" strokeLinecap="round" strokeWidth="2" x1="1" x2="9" y1="1" y2="1" />
          </svg>
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      <span className={styles.label}>{label}</span>
    </Label>
  );
}
