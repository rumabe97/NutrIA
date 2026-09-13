import styles from './Button.module.css';

import type { ComponentPropsWithRef } from 'react';
import type { Size } from 'ui/types/Sizes.types';

type ButtonSize = Exclude<Size, 'xs' | 'xl'>;

type ButtonVariant = 'destructive' | 'primary' | 'secondary' | 'tertiary';

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  /**
   * Shows a spinner and disables the button while a mutation is in flight.
   *
   * On the control that started it, not somewhere else on the page: the person
   * who pressed a button is looking at that button. Prefer this over a bare
   * `disabled`, which says "you cannot" rather than "we are".
   */
  loading?: boolean;
  /** Height tier — `sm` / `md` / `lg` (32/40/48px). Defaults to `md`. On a coarse pointer every tier is at least 44px tall. */
  size?: ButtonSize;
  /**
   * Visual emphasis. One `primary` per view; `secondary` for the rest (and for
   * toggles, which show `aria-pressed` on it); `tertiary` for a quiet action
   * that reads as a link; `destructive` for the one that deletes something.
   * Defaults to `primary`.
   */
  variant?: ButtonVariant;
}

/**
 * The classes a button wears, for an element that is not a `<button>`.
 *
 * A link that navigates but should read as a button — a call to action, a
 * pager step — must stay an `<a>`: wrapping it in a `<button>` is invalid HTML
 * and breaks middle-click and "open in new tab". It borrows the look instead,
 * so there is one button vocabulary however the element is spelled.
 */
export function buttonClassName({
  className,
  size = 'md',
  variant = 'primary'
}: Readonly<{ className?: string; size?: ButtonSize; variant?: ButtonVariant }>): string {
  return [styles.button, styles[variant], styles[size], className].filter(Boolean).join(' ');
}

export function Button({ children, className, disabled, loading = false, size = 'md', variant = 'primary', ...rest }: ButtonProps) {
  return (
    // `aria-busy` rather than only the visual spinner: a screen reader user gets
    // the same "something is happening" the sighted one does.
    <button aria-busy={loading || undefined} className={buttonClassName({ className, size, variant })} disabled={disabled ?? loading} {...rest}>
      {/* A ring rather than `ui/components/Spinner`, which is an eight-leaf mark
          designed for 20px and up. Scaled to fit a 24px button its leaves are
          1.5px wide at 65% opacity — present in the DOM and invisible on screen,
          which is the worst of both. A 2px stroke reads at any button height. */}
      {loading ? <span aria-hidden="true" className={styles.spinner} /> : null}
      {children}
    </button>
  );
}
