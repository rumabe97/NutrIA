import styles from './Text.module.css';

import type { ComponentPropsWithRef } from 'react';

type TextElement = 'em' | 'mark' | 'p' | 's' | 'small' | 'span' | 'strong';
type TextSize = 'xs' | 'sm' | 'md' | 'lg';
type TextWeight = 'bold' | 'medium' | 'regular' | 'semibold';
type TextTone = 'disabled' | 'primary' | 'secondary' | 'tertiary';
type TextAlign = 'center' | 'end' | 'justify' | 'start';

// Locked to `'p'` (the default rendered tag) rather than `TextElement` because the union
// members resolve to *different* element types (HTMLParagraphElement vs HTMLSpanElement
// vs HTMLElement). A union here would make `ref` typing diverge per branch and require
// true polymorphic-component typing — not worth the complexity. Consumers who pass
// `as="span"` accept the resulting ref-type imprecision. See "One nuance for polymorphic
// components" in packages/ui/AGENTS.md.
export interface TextProps extends ComponentPropsWithRef<'p'> {
  /** Text alignment, writing-direction aware. */
  align?: TextAlign;
  /** Underlying tag. Defaults to `<p>`; switch for inline (`span`) or semantic emphasis (`strong`/`em`/`mark`/`s`/`small`). */
  as?: TextElement;
  /** Visual size tier (`--font-size-01`–`04`, 12→16px). Defaults to `md` (14px). */
  size?: TextSize;
  /** Text colour (`--foreground-01/02/03/disabled`). `tertiary` is sub-AA — use sparingly. `disabled` is WCAG-exempt. */
  tone?: TextTone;
  /** Font weight. Omit to inherit (useful when nested inside a `<Heading>` or styled block). */
  weight?: TextWeight;
}

export function Text({ align, as: Component = 'p', className, size = 'md', tone = 'primary', weight, ...rest }: TextProps) {
  const classes = [
    styles.text,
    styles[`size-${size}`],
    weight && styles[`weight-${weight}`],
    styles[`tone-${tone}`],
    align && styles[`align-${align}`],
    className
  ]
    .filter(Boolean)
    .join(' ');

  return <Component className={classes} {...rest} />;
}
