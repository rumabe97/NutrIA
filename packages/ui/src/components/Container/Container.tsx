import styles from './Container.module.css';

import type { ComponentPropsWithRef, CSSProperties, ElementType } from 'react';
import type { Size } from 'ui/types/Sizes.types';
import type { SpaceScale } from 'ui/types/Space.types';

type ContainerSize = Exclude<Size, 'xs'>;

export interface ContainerProps extends ComponentPropsWithRef<'div'> {
  /** Underlying tag. Defaults to `<div>`; switch to a landmark (`main`/`article`/`aside`) when relevant. */
  as?: ElementType;
  /** Horizontal padding from the spacing scale — resolves to `var(--space-${px})`. */
  px?: SpaceScale;
  /** Max-width tier. `sm` / `md` / `lg` (default) / `xl`. */
  size?: ContainerSize;
}

export function Container({ as: Component = 'div', className, px, size = 'lg', style, ...rest }: ContainerProps) {
  const composedStyle: CSSProperties = { ...style };

  if (px) {
    composedStyle.paddingInline = `var(--space-${px})`;
  }

  return <Component className={[styles.container, styles[size], className].filter(Boolean).join(' ')} style={composedStyle} {...rest} />;
}
