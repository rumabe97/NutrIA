import { Content } from '@radix-ui/react-collapsible';

import styles from './CollapsibleContent.module.css';

import type { CollapsibleContentProps as RadixCollapsibleContentProps } from '@radix-ui/react-collapsible';

export interface CollapsibleContentProps extends RadixCollapsibleContentProps {}

export function CollapsibleContent({ className, ...rest }: CollapsibleContentProps) {
  return <Content className={className ? `${styles.content} ${className}` : styles.content} {...rest} />;
}
