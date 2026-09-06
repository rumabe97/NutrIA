import { Trigger } from '@radix-ui/react-collapsible';

import styles from './CollapsibleTrigger.module.css';

import type { CollapsibleTriggerProps as RadixCollapsibleTriggerProps } from '@radix-ui/react-collapsible';

export interface CollapsibleTriggerProps extends RadixCollapsibleTriggerProps {}

export function CollapsibleTrigger({ className, ...rest }: CollapsibleTriggerProps) {
  return <Trigger className={className ? `${styles.trigger} ${className}` : styles.trigger} {...rest} />;
}
