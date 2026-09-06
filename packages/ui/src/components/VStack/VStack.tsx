import styles from './VStack.module.css';

import type { ComponentPropsWithRef, CSSProperties, ElementType } from 'react';
import type { SpaceScale } from 'ui/types/Space.types';

export interface VStackProps extends ComponentPropsWithRef<'div'> {
  /** `align-items` — horizontal (cross-axis) alignment. */
  align?: CSSProperties['alignItems'];
  /** Underlying tag. Defaults to `<div>`. */
  as?: ElementType;
  /** Vertical gap from the spacing scale — resolves to `var(--space-${gap})`. */
  gap?: SpaceScale;
  /** `justify-content` — vertical distribution. */
  justify?: CSSProperties['justifyContent'];
}

export function VStack({ align, as: Component = 'div', className, gap, justify, style, ...rest }: VStackProps) {
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

  return <Component className={className ? `${styles.vstack} ${className}` : styles.vstack} style={composedStyle} {...rest} />;
}
