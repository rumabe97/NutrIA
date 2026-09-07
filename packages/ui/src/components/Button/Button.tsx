import styles from './Button.module.css';

import type { ComponentPropsWithRef } from 'react';
import type { Size } from 'ui/types/Sizes.types';

type ButtonSize = Exclude<Size, 'xs' | 'xl'>;

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
    // `aria-busy` rather than only the visual spinner: a screen reader user gets
    // the same "something is happening" the sighted one does.
    <button aria-busy={loading || undefined} className={classes} disabled={disabled ?? loading} {...rest}>
      {/* A ring rather than `ui/components/Spinner`, which is an eight-leaf mark
          designed for 20px and up. Scaled to fit a 24px button its leaves are
          1.5px wide at 65% opacity — present in the DOM and invisible on screen,
          which is the worst of both. A 2px stroke reads at any button height. */}
      {loading ? <span aria-hidden="true" className={styles.spinner} /> : null}
      {children}
    </button>
  );
}
