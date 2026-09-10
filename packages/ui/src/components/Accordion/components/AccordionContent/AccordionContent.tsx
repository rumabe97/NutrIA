import { Content } from '@radix-ui/react-accordion';

import styles from './AccordionContent.module.css';

import type { AccordionContentProps as RadixAccordionContentProps } from '@radix-ui/react-accordion';

export interface AccordionContentProps extends RadixAccordionContentProps {}

/**
 * Mounted whether it is open or not, and hidden by CSS.
 *
 * Radix unmounts closed content, which is right for a panel behind a network
 * request and wrong for prose: a page of FAQ answers inside a closed accordion
 * is a page whose answers are absent from the served HTML — visible to a person
 * who clicks, invisible to anything that reads the document. `forceMount` puts
 * the words in the markup; `[data-state='closed']` takes them off the screen,
 * out of the tab order and out of the accessibility tree.
 *
 * `forceMount` stays overridable through the spread: content that is expensive
 * to render, or that fetches on mount, is the case Radix's default is for.
 */
export function AccordionContent({ children, className, ...rest }: AccordionContentProps) {
  return (
    <Content className={className ? `${styles.content} ${className}` : styles.content} forceMount={true} {...rest}>
      <div className={styles.inner}>{children}</div>
    </Content>
  );
}
