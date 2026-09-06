import { Portal, Root } from '@radix-ui/react-context-menu';

import { ContextMenuContent } from './components/ContextMenuContent';
import { ContextMenuTrigger } from './components/ContextMenuTrigger';

import type { ContextMenuProps as RadixContextMenuProps } from '@radix-ui/react-context-menu';
import type { ReactElement } from 'react';

export interface ContextMenuProps extends RadixContextMenuProps {
  /** **Required.** Element that opens the menu on right-click / long-press / `Shift+F10`. Wrapped via `Trigger asChild`. */
  trigger: ReactElement;
}

export function ContextMenu({ children, trigger, ...rest }: ContextMenuProps) {
  return (
    <Root {...rest}>
      <ContextMenuTrigger>{trigger}</ContextMenuTrigger>
      <Portal>
        <ContextMenuContent>{children}</ContextMenuContent>
      </Portal>
    </Root>
  );
}
