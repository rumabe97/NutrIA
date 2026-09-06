import { Group } from '@radix-ui/react-dropdown-menu';

import type { DropdownMenuGroupProps } from '@radix-ui/react-dropdown-menu';

export interface DropdownGroupProps extends Omit<DropdownMenuGroupProps, 'asChild'> {}

export function DropdownGroup({ children, ...rest }: DropdownGroupProps) {
  return <Group {...rest}>{children}</Group>;
}
