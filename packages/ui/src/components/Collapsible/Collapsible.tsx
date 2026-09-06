import { Root } from '@radix-ui/react-collapsible';

import styles from './Collapsible.module.css';

import type { CollapsibleProps as RadixCollapsibleProps } from '@radix-ui/react-collapsible';

export interface CollapsibleProps extends RadixCollapsibleProps {}

export function Collapsible({ className, ...rest }: CollapsibleProps) {
  return <Root className={className ? `${styles.root} ${className}` : styles.root} {...rest} />;
}
