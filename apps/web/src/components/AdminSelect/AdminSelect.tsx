import { useId } from 'react';

import styles from './AdminSelect.module.css';

import { Label } from 'ui/components/Label';

import type { ComponentPropsWithRef } from 'react';

interface AdminSelectProps extends Omit<ComponentPropsWithRef<'select'>, 'aria-describedby' | 'children' | 'id'> {
  /** **Required.** The visible label. */
  label: string;
  /** What each option says. `lang` marks one in another language than the page's. */
  options: readonly { readonly label: string; readonly value: string }[];
}

/**
 * A native `<select>` drawn as the fields it sits among (project 025 phase 9): a
 * visible label, the same edge, height and touch floor as `ui/components/Input`, and
 * a chevron. Native, because it is the picker a phone already knows and it needs no
 * keyboard handling of its own; the form that holds it reads its value from state.
 */
export function AdminSelect({ className, label, options, ...rest }: AdminSelectProps) {
  const id = useId();

  return (
    <div className={className ? `${styles.root} ${className}` : styles.root}>
      <Label className={styles.label} htmlFor={id}>
        {label}
      </Label>
      <span className={styles.field}>
        <select className={styles.control} id={id} {...rest}>
          {options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <svg aria-hidden="true" className={styles.chevron} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  );
}
