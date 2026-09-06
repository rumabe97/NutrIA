import { Item, ItemIndicator, ItemText } from '@radix-ui/react-select';

import styles from './SelectOption.module.css';

import type { ReactNode } from 'react';
import type { SelectItemProps } from '@radix-ui/react-select';

export interface SelectOptionProps extends SelectItemProps {
  /** **Required.** Marker shown next to the selected option (e.g. `'✓'` or a dot). Decorative — assistive tech reads the option text. */
  indicator: ReactNode;
}

export function SelectOption({ children, className, indicator, ...rest }: SelectOptionProps) {
  return (
    <Item className={className ? `${styles.option} ${className}` : styles.option} {...rest}>
      <ItemText>{children}</ItemText>
      <ItemIndicator className={styles.indicator}>{indicator}</ItemIndicator>
    </Item>
  );
}
