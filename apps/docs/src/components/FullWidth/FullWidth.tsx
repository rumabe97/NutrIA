import styles from './FullWidth.module.css';

import type { ReactNode } from 'react';

interface FullWidthProps {
  children: ReactNode;
}

/**
 * Lets an example take the preview's whole width. The preview centres its content,
 * which shrinks anything without a width of its own — a chart that fills its
 * container would collapse to nothing.
 *
 * The docs follow the reader's system scheme; a chart page is checked in both by
 * switching it. A panel that forced one scheme cannot work here: the tokens are
 * `light-dark()` pairs declared on `:root`, and the browser resolves them there.
 */
export function FullWidth({ children }: FullWidthProps) {
  return <div className={styles.root}>{children}</div>;
}
