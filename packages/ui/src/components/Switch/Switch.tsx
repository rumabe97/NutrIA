import { Root, Thumb } from '@radix-ui/react-switch';

import styles from './Switch.module.css';

import type { SwitchProps as RadixSwitchProps } from '@radix-ui/react-switch';

export interface SwitchProps extends RadixSwitchProps {}

export function Switch({ className, ...rest }: SwitchProps) {
  return (
    <Root className={className ? `${styles.root} ${className}` : styles.root} {...rest}>
      <Thumb className={styles.thumb} />
    </Root>
  );
}
