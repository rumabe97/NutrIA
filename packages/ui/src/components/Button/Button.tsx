import styles from './Button.module.css';

import type { ComponentPropsWithRef } from 'react';
import type { Size } from 'ui/types/Sizes.types';

type ButtonSize = Exclude<Size, 'xs' | 'xl'>;

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  /** Height tier — `sm` / `md` / `lg` (24/32/40px). Defaults to `md`. */
  size?: ButtonSize;
  /** Visual emphasis. `primary` for the main action, `secondary` for cancel/back. Defaults to `primary`. */
  variant?: 'primary' | 'secondary';
}

export function Button({ children, className, size = 'md', variant = 'primary', ...rest }: ButtonProps) {
  const classes = [styles.button, styles[variant], styles[size], className].filter(Boolean).join(' ');

  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
