import { Root } from '@radix-ui/react-accordion';

import styles from './Accordion.module.css';

import type { AccordionMultipleProps, AccordionSingleProps } from '@radix-ui/react-accordion';

export type AccordionProps = AccordionMultipleProps | AccordionSingleProps;

export function Accordion({ children, className, ...rest }: AccordionProps) {
  return (
    <Root className={className ? `${styles.root} ${className}` : styles.root} {...rest}>
      {children}
    </Root>
  );
}
