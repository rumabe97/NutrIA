import { Root } from '@radix-ui/react-tabs';

import type { TabsProps as RadixTabsProps } from '@radix-ui/react-tabs';

export interface TabsProps extends RadixTabsProps {}

export function Tabs({ children, ...rest }: TabsProps) {
  return <Root {...rest}>{children}</Root>;
}
