import { Item } from '@radix-ui/react-accordion';

import styles from './AccordionItem.module.css';

import { AccordionContent } from '../AccordionContent';
import { AccordionTrigger } from '../AccordionTrigger';

import type { AccordionItemProps as RadixAccordionItemProps } from '@radix-ui/react-accordion';
import type { ReactNode } from 'react';

export interface AccordionItemProps extends Omit<RadixAccordionItemProps, 'children'> {
  /** Content revealed when the item is expanded. */
  children: ReactNode;
  /** **Required.** Always-visible header label that toggles the item. Keep it free of interactive elements (it's already a button). */
  trigger: ReactNode;
}

export function AccordionItem({ children, className, trigger, ...rest }: AccordionItemProps) {
  return (
    <Item className={className ? `${styles.item} ${className}` : styles.item} {...rest}>
      <AccordionTrigger>{trigger}</AccordionTrigger>
      <AccordionContent>{children}</AccordionContent>
    </Item>
  );
}
