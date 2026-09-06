import { Trigger } from '@radix-ui/react-context-menu';

import type { ContextMenuTriggerProps as RadixContextMenuTriggerProps } from '@radix-ui/react-context-menu';

export interface ContextMenuTriggerProps extends Omit<RadixContextMenuTriggerProps, 'asChild'> {}

export function ContextMenuTrigger({ children, ...rest }: ContextMenuTriggerProps) {
  return (
    <Trigger asChild={true} {...rest}>
      {children}
    </Trigger>
  );
}
