import { Indicator, Item } from '@radix-ui/react-radio-group';
import { useId } from 'react';

import styles from './RadioGroupItem.module.css';

import { Label } from 'ui/components/Label';

import type { RadioGroupItemProps as RadixRadioGroupItemProps } from '@radix-ui/react-radio-group';
import type { ReactNode } from 'react';

export interface RadioGroupItemProps extends RadixRadioGroupItemProps {
  /** **Required.** Label rendered alongside the radio — the whole `<label>` is the click target (WCAG 2.5.8). Pass a visually-hidden node for label-less cases. */
  label: ReactNode;
}

export function RadioGroupItem({ className, label, ...rest }: RadioGroupItemProps) {
  const id = useId();
  const itemId = rest.id ?? id;
  const wrapperClass = className ? `${styles.wrapper} ${className}` : styles.wrapper;

  return (
    <Label className={wrapperClass} htmlFor={itemId}>
      <Item className={styles.item} id={itemId} {...rest}>
        <Indicator className={styles.indicator}>
          <span className={styles.dot} />
        </Indicator>
      </Item>
      <span className={styles.label}>{label}</span>
    </Label>
  );
}
