import { Content } from '@radix-ui/react-tabs';

import styles from './TabsContent.module.css';

import type { TabsContentProps as RadixTabsContentProps } from '@radix-ui/react-tabs';

export interface TabsContentProps extends RadixTabsContentProps {}

export function TabsContent({ children, className, ...rest }: TabsContentProps) {
  return (
    <Content className={className ? `${styles.content} ${className}` : styles.content} {...rest}>
      {children}
    </Content>
  );
}
