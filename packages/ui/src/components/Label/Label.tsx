import { Root } from '@radix-ui/react-label';

import styles from './Label.module.css';

import type { ComponentPropsWithRef } from 'react';

export interface LabelProps extends ComponentPropsWithRef<typeof Root> {}

export function Label({ className, ...rest }: LabelProps) {
  const classes = [styles.label, className].filter(Boolean).join(' ');

  return <Root className={classes} {...rest} />;
}
