import styles from './Flex.module.css';

import type { ComponentPropsWithRef, CSSProperties, ElementType } from 'react';
import type { SpaceScale } from 'ui/types/Space.types';

export interface FlexProps extends ComponentPropsWithRef<'div'> {
  /** `align-items` — cross-axis alignment. */
  align?: CSSProperties['alignItems'];
  /** Underlying tag. Defaults to `<div>`; switch for semantics (`nav`/`header`/`footer`/`section`). */
  as?: ElementType;
  /** `flex-direction`. Defaults to `row`. */
  direction?: CSSProperties['flexDirection'];
  /** Gap between children from the spacing scale — resolves to `var(--space-${gap})`. */
  gap?: SpaceScale;
  /** Switches `display` to `inline-flex`. */
  inline?: boolean;
  /** `justify-content` — main-axis distribution. */
  justify?: CSSProperties['justifyContent'];
  /** `flex-wrap`. Defaults to `nowrap`. */
  wrap?: CSSProperties['flexWrap'];
}

export function Flex({ align, as: Component = 'div', className, direction, gap, inline, justify, style, wrap, ...rest }: FlexProps) {
  const composedStyle: CSSProperties = { ...style };

  if (inline) {
    composedStyle.display = 'inline-flex';
  }

  if (direction) {
    composedStyle.flexDirection = direction;
  }

  if (align) {
    composedStyle.alignItems = align;
  }

  if (justify) {
    composedStyle.justifyContent = justify;
  }

  if (gap) {
    composedStyle.gap = `var(--space-${gap})`;
  }

  if (wrap) {
    composedStyle.flexWrap = wrap;
  }

  return <Component className={className ? `${styles.flex} ${className}` : styles.flex} style={composedStyle} {...rest} />;
}
