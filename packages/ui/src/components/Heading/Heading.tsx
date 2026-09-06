import styles from './Heading.module.css';

import type { ComponentPropsWithRef } from 'react';

type HeadingLevel = '1' | '2' | '3' | '4' | '5' | '6';
type HeadingSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type HeadingWeight = 'bold' | 'medium' | 'regular' | 'semibold';
type HeadingTone = 'primary' | 'secondary' | 'tertiary';
type HeadingAlign = 'center' | 'end' | 'start';

const LEVEL_DEFAULT_SIZE: Record<HeadingLevel, HeadingSize> = { '1': 'xl', '2': 'lg', '3': 'md', '4': 'sm', '5': 'sm', '6': 'xs' };

type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

// h1-h6 all resolve to HTMLAttributes<HTMLHeadingElement> in @types/react, so the union
// collapses to a single type and the interface extend works cleanly. Tying the props to
// the same `HeadingTag` union the render logic uses keeps the two in sync if we ever
// add/remove a level.
export interface HeadingProps extends ComponentPropsWithRef<HeadingTag> {
  /** Text alignment, writing-direction aware. */
  align?: HeadingAlign;
  /** **Required.** Semantic HTML level — drives the document outline. Don't skip levels for visual reasons; use `size` for that. */
  level: HeadingLevel;
  /** Visual size tier (`--font-size-05`–`09`, 18→36px). Defaults to a per-level value; override when visual and semantic hierarchy diverge. */
  size?: HeadingSize;
  /** Text colour (`--foreground-01/02/03`). `tertiary` is sub-AA — use sparingly. Defaults to `primary`. */
  tone?: HeadingTone;
  /** Font weight. Defaults to `semibold`. */
  weight?: HeadingWeight;
}

export function Heading({ align, className, level, size, tone = 'primary', weight = 'semibold', ...rest }: HeadingProps) {
  const Tag = `h${level}` as HeadingTag;
  const resolvedSize = size ?? LEVEL_DEFAULT_SIZE[level];
  const classes = [
    styles.heading,
    styles[`size-${resolvedSize}`],
    styles[`weight-${weight}`],
    styles[`tone-${tone}`],
    align && styles[`align-${align}`],
    className
  ]
    .filter(Boolean)
    .join(' ');

  return <Tag className={classes} {...rest} />;
}
