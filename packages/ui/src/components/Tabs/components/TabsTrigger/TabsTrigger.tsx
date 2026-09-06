import { Trigger } from '@radix-ui/react-tabs';

import styles from './TabsTrigger.module.css';

import type { TabsTriggerProps as RadixTabsTriggerProps } from '@radix-ui/react-tabs';

export interface TabsTriggerProps extends RadixTabsTriggerProps {}

export function TabsTrigger({ children, className, ...rest }: TabsTriggerProps) {
  return (
    <Trigger className={className ? `${styles.trigger} ${className}` : styles.trigger} {...rest}>
      {children}
    </Trigger>
  );
}
