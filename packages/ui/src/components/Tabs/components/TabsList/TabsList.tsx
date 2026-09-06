import { List } from '@radix-ui/react-tabs';

import styles from './TabsList.module.css';

import type { TabsListProps as RadixTabsListProps } from '@radix-ui/react-tabs';

export interface TabsListProps extends RadixTabsListProps {}

export function TabsList({ children, className, ...rest }: TabsListProps) {
  return (
    <List className={className ? `${styles.list} ${className}` : styles.list} {...rest}>
      {children}
    </List>
  );
}
