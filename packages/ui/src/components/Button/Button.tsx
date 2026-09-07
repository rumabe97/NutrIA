import styles from './Button.module.css';

import { Spinner } from 'ui/components/Spinner';

import type { ComponentPropsWithRef } from 'react';
import type { Size } from 'ui/types/Sizes.types';

type ButtonSize = Exclude<Size, 'xs' | 'xl'>;

/** Spinner size per button height, so it is never taller than the label beside it. */
const SPINNER_SIZE: Record<ButtonSize, number> = { lg: 16, md: 14, sm: 12 };

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  /**
   * Shows a spinner and disables the button while a mutation is in flight.
   *
   * On the control that started it, not somewhere else on the page: the person
   * who pressed a button is looking at that button. Prefer this over a bare
   * `disabled`, which says "you cannot" rather than "we are".
   */
  loading?: boolean;
  /** Height tier — `sm` / `md` / `lg` (24/32/40px). Defaults to `md`. */
  size?: ButtonSize;
  /** Visual emphasis. `primary` for the main action, `secondary` for cancel/back. Defaults to `primary`. */
  variant?: 'primary' | 'secondary';
}

export function Button({ children, className, disabled, loading = false, size = 'md', variant = 'primary', ...rest }: ButtonProps) {
  const classes = [styles.button, styles[variant], styles[size], className].filter(Boolean).join(' ');

  return (
    // `aria-busy` rather than only the visual spinner: a screen reader user
    // gets the same "something is happening" the sighted one does.
    <button aria-busy={loading || undefined} className={classes} disabled={disabled ?? loading} {...rest}>
      {loading ? <Spinner className={styles.spinner} size={SPINNER_SIZE[size]} /> : null}
      {children}
    </button>
  );
}
