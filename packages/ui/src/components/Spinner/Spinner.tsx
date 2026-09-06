import styles from './Spinner.module.css';

import type { ComponentPropsWithRef } from 'react';

export interface SpinnerProps extends ComponentPropsWithRef<'span'> {
  /** Accessible name. Exposes the spinner as `role="status"` with a visually-hidden label. For many-skeleton pages, wrap the region in `role="status"` once instead. */
  label?: string;
  /** Outer square size in pixels. Defaults to 20. */
  size?: number;
}

const LEAVES = Array.from({ length: 8 }, (_, i) => i);

export function Spinner({ className, label, ref, size = 20, ...rest }: SpinnerProps) {
  return (
    <span
      aria-hidden={label ? undefined : 'true'}
      className={className ? `${styles.spinner} ${className}` : styles.spinner}
      ref={ref}
      role={label ? 'status' : undefined}
      style={{ height: size, width: size }}
      {...rest}
    >
      {LEAVES.map(index => (
        <span className={styles.leaf} key={index} />
      ))}
      {label ? <span className="visually-hidden">{label}</span> : null}
    </span>
  );
}
