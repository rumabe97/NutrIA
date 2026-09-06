import styles from './Grid.module.css';

import type { ComponentPropsWithRef, CSSProperties, ElementType } from 'react';
import type { SpaceScale } from 'ui/types/Space.types';

type GridCount = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12';

export interface GridProps extends ComponentPropsWithRef<'div'> {
  /** `align-items` — alignment within each cell. */
  align?: CSSProperties['alignItems'];
  /** Underlying tag. Defaults to `<div>`. */
  as?: ElementType;
  /** Equal columns (1–12). For uneven widths, set `gridTemplateColumns` via `style` instead. */
  columns?: GridCount;
  /** Gap from the spacing scale — resolves to `var(--space-${gap})`. */
  gap?: SpaceScale;
  /** Switches `display` to `inline-grid`. */
  inline?: boolean;
  /** `justify-content` — inline-axis distribution. */
  justify?: CSSProperties['justifyContent'];
  /** Equal rows (1–12). Usually you only need `columns` and let rows auto-flow. */
  rows?: GridCount;
}

export function Grid({ align, as: Component = 'div', className, columns, gap, inline, justify, rows, style, ...rest }: GridProps) {
  const composedStyle: CSSProperties = { ...style };

  if (inline) {
    composedStyle.display = 'inline-grid';
  }

  if (columns) {
    composedStyle.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
  }

  if (rows) {
    composedStyle.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
  }

  if (gap) {
    composedStyle.gap = `var(--space-${gap})`;
  }

  if (align) {
    composedStyle.alignItems = align;
  }

  if (justify) {
    composedStyle.justifyContent = justify;
  }

  return <Component className={className ? `${styles.grid} ${className}` : styles.grid} style={composedStyle} {...rest} />;
}
