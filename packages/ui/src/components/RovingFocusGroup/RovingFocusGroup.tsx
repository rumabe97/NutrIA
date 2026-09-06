import { Item, Root } from '@radix-ui/react-roving-focus';

import type { ComponentPropsWithRef } from 'react';

export interface RovingFocusGroupProps extends ComponentPropsWithRef<typeof Root> {}
export interface RovingFocusGroupItemProps extends ComponentPropsWithRef<typeof Item> {}

export function RovingFocusGroup({ className, ref, ...rest }: RovingFocusGroupProps) {
  return <Root className={className} ref={ref} {...rest} />;
}

export function RovingFocusGroupItem({ className, ref, ...rest }: RovingFocusGroupItemProps) {
  return <Item className={className} ref={ref} {...rest} />;
}
