import { Header, Trigger } from '@radix-ui/react-accordion';

import styles from './AccordionTrigger.module.css';

import type { AccordionTriggerProps as RadixAccordionTriggerProps } from '@radix-ui/react-accordion';

export interface AccordionTriggerProps extends RadixAccordionTriggerProps {}

export function AccordionTrigger({ children, className, ...rest }: AccordionTriggerProps) {
  return (
    <Header className={styles.header}>
      <Trigger className={className ? `${styles.trigger} ${className}` : styles.trigger} {...rest}>
        {children}
        <span aria-hidden={true} className={styles.chevron} />
      </Trigger>
    </Header>
  );
}
