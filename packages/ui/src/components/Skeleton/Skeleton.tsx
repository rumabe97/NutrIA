import styles from './Skeleton.module.css';

import type { ComponentPropsWithRef, CSSProperties, ReactNode } from 'react';

export type SkeletonAnimation = 'none' | 'pulse' | 'shimmer' | 'wave';

export interface SkeletonProps extends Omit<ComponentPropsWithRef<'span'>, 'children'> {
  /** `shimmer` (default, subtle) / `pulse` (stronger) / `wave` (hero placeholders) / `none`. All respect `prefers-reduced-motion`. */
  animation?: SkeletonAnimation;
  /** Invisible content used to size the skeleton against. */
  children?: ReactNode;
  /** CSS height (e.g. `"1rem"`). Ignored when `children` is set. */
  height?: string;
  /** Border radius in pixels. Defaults to 4. */
  radius?: number;
  /** CSS width. Ignored when `children` is set. */
  width?: string;
}

const ANIMATION_CLASS: Record<SkeletonAnimation, string | undefined> = {
  none: undefined,
  pulse: styles.pulse,
  shimmer: styles.shimmer,
  wave: styles.wave
};

export function Skeleton({ animation = 'shimmer', children, className, height, radius = 4, ref, style, width, ...rest }: SkeletonProps) {
  const composedStyle: CSSProperties = { borderRadius: radius, ...style };

  if (!children) {
    if (height) {
      composedStyle.height = height;
    }

    if (width) {
      composedStyle.width = width;
    }
  }

  const classes = [styles.skeleton, ANIMATION_CLASS[animation], className].filter(Boolean).join(' ');

  return (
    <span aria-busy={true} className={classes} ref={ref} style={composedStyle} {...rest}>
      {children ? <span className={styles.measure}>{children}</span> : null}
    </span>
  );
}
