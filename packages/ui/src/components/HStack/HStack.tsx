import styles from './HStack.module.css';

import type { ComponentPropsWithRef, CSSProperties, ElementType } from 'react';
import type { SpaceScale } from 'ui/types/Space.types';

export interface HStackProps extends ComponentPropsWithRef<'div'> {
  /** `align-items` — vertical (cross-axis) alignment. */
  align?: CSSProperties['alignItems'];
  /** Underlying tag. Defaults to `<div>`. */
  as?: ElementType;
  /** Horizontal gap from the spacing scale — resolves to `var(--space-${gap})`. */
  gap?: SpaceScale;
  /** `justify-content` — horizontal distribution. */
  justify?: CSSProperties['justifyContent'];
  /** Whether children wrap to a new line. Defaults to `true`; set `false` for non-wrapping nav rows. */
  wrap?: boolean;
}

export function HStack({ align, as: Component = 'div', className, gap, justify, style, wrap = true, ...rest }: HStackProps) {
  const composedStyle: CSSProperties = { ...style };

  if (gap) {
    composedStyle.gap = `var(--space-${gap})`;
  }

  if (align) {
    composedStyle.alignItems = align;
  }

  if (justify) {
    composedStyle.justifyContent = justify;
  }

  if (!wrap) {
    composedStyle.flexWrap = 'nowrap';
  }

  return <Component className={className ? `${styles.hstack} ${className}` : styles.hstack} style={composedStyle} {...rest} />;
}
