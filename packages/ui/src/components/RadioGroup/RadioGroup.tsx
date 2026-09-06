import { Root } from '@radix-ui/react-radio-group';

import styles from './RadioGroup.module.css';

import type { RadioGroupProps as RadixRadioGroupProps } from '@radix-ui/react-radio-group';

export interface RadioGroupProps extends RadixRadioGroupProps {}

export function RadioGroup({ className, ...rest }: RadioGroupProps) {
  return <Root className={className ? `${styles.root} ${className}` : styles.root} {...rest} />;
}
