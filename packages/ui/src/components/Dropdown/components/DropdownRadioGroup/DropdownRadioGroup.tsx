import { RadioGroup } from '@radix-ui/react-dropdown-menu';

import type { DropdownMenuRadioGroupProps } from '@radix-ui/react-dropdown-menu';

export interface DropdownRadioGroupProps extends Omit<DropdownMenuRadioGroupProps, 'asChild'> {}

/** A set of `DropdownRadioOption`s of which one is chosen: `value` and `onValueChange`. */
export function DropdownRadioGroup({ children, ...rest }: DropdownRadioGroupProps) {
  return <RadioGroup {...rest}>{children}</RadioGroup>;
}
