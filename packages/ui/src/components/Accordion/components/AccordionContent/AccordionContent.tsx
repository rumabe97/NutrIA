import { Content } from '@radix-ui/react-accordion';

import styles from './AccordionContent.module.css';

import type { AccordionContentProps as RadixAccordionContentProps } from '@radix-ui/react-accordion';

export interface AccordionContentProps extends RadixAccordionContentProps {}

export function AccordionContent({ children, className, ...rest }: AccordionContentProps) {
  return (
    <Content className={className ? `${styles.content} ${className}` : styles.content} {...rest}>
      <div className={styles.inner}>{children}</div>
    </Content>
  );
}
