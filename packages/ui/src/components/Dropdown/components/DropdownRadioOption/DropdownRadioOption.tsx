import { ItemIndicator, RadioItem } from '@radix-ui/react-dropdown-menu';

import styles from './DropdownRadioOption.module.css';

import type { DropdownMenuRadioItemProps } from '@radix-ui/react-dropdown-menu';

export interface DropdownRadioOptionProps extends DropdownMenuRadioItemProps {}

/**
 * One choice of a `DropdownRadioGroup`: a `menuitemradio` whose `aria-checked` says which is
 * chosen, and a tick that says it to the eye — never colour alone.
 */
export function DropdownRadioOption({ children, className, ...rest }: DropdownRadioOptionProps) {
  return (
    <RadioItem className={className ? `${styles.option} ${className}` : styles.option} {...rest}>
      <span aria-hidden="true" className={styles.slot}>
        <ItemIndicator className={styles.indicator}>
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 16 16">
            <path d="M3.5 8.5 6.5 11.5 12.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </ItemIndicator>
      </span>
      {children}
    </RadioItem>
  );
}
