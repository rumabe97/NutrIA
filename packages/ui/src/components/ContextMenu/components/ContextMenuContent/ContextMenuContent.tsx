import { Content } from '@radix-ui/react-context-menu';

import styles from './ContextMenuContent.module.css';

import type { ContextMenuContentProps as RadixContextMenuContentProps } from '@radix-ui/react-context-menu';

export interface ContextMenuContentProps extends Omit<RadixContextMenuContentProps, 'asChild'> {}

export function ContextMenuContent({ children, className, ...rest }: ContextMenuContentProps) {
  return (
    <Content className={`${styles.panel} motion-unfold${className ? ` ${className}` : ''}`} {...rest}>
      {children}
    </Content>
  );
}
