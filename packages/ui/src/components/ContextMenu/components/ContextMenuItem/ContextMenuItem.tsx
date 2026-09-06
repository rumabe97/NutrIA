import { Item } from '@radix-ui/react-context-menu';

import styles from './ContextMenuItem.module.css';

import type { ContextMenuItemProps as RadixContextMenuItemProps } from '@radix-ui/react-context-menu';
import type { ReactNode } from 'react';

export interface ContextMenuItemProps extends RadixContextMenuItemProps {
  /** Leading visual (usually an icon). Decorative — `children` must carry the accessible meaning. */
  icon?: ReactNode;
  /** Trailing slot — keyboard shortcut hint (`'⌘K'`) or submenu chevron. Visual only. */
  suffix?: ReactNode;
}

export function ContextMenuItem({ children, className, icon, suffix, ...rest }: ContextMenuItemProps) {
  return (
    <Item className={className ? `${styles.item} ${className}` : styles.item} {...rest}>
      <div className={styles.content}>
        {icon ? icon : null}
        {children}
      </div>
      {suffix ? <div className={styles.suffix}>{suffix}</div> : null}
    </Item>
  );
}
