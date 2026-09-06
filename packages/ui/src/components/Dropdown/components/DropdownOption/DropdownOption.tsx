import { Item } from '@radix-ui/react-dropdown-menu';

import styles from './DropdownOption.module.css';

import type { DropdownMenuItemProps } from '@radix-ui/react-dropdown-menu';

export interface DropdownOptionProps extends DropdownMenuItemProps {}

export function DropdownOption({ children, className, ...rest }: DropdownOptionProps) {
  return (
    <Item className={className ? `${styles.option} ${className}` : styles.option} {...rest}>
      {children}
    </Item>
  );
}
