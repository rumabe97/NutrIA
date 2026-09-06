import styles from './Divider.module.css';

import type { ComponentPropsWithRef } from 'react';

export type DividerProps = ComponentPropsWithRef<'hr'>;

export function Divider({ className, ref, style, ...rest }: DividerProps) {
  return <hr className={className ? `${styles.divider} ${className}` : styles.divider} ref={ref} style={style} {...rest} />;
}
