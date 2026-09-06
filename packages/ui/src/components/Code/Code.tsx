import styles from './Code.module.css';

import type { ComponentPropsWithRef } from 'react';

export interface CodeProps extends ComponentPropsWithRef<'code'> {}

export function Code({ className, ...rest }: CodeProps) {
  return <code className={className ? `${styles.code} ${className}` : styles.code} {...rest} />;
}
