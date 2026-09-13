import styles from './Card.module.css';

import type { ComponentPropsWithoutRef, ElementType } from 'react';

type CardPadding = 'default' | 'lg' | 'sm';

type CardProps<T extends ElementType> = Omit<ComponentPropsWithoutRef<T>, 'as' | 'padding'> & {
  /** The element to draw: a `section` for a titled block, `li` in a list, a link when the whole card opens something. */
  as?: T;
  /** `lg` for a card that is the whole screen, `sm` for a tile holding one figure. */
  padding?: CardPadding;
};

const PADDING: Record<CardPadding, string | undefined> = { default: undefined, lg: styles.lg, sm: styles.sm };

/**
 * The one raised surface of the product.
 *
 * Every card used to carry its own copy of the same five declarations, and
 * sixteen copies had drifted: three radii, tiles with no shadow, one card that
 * set its shadow twice. A card is a card because it looks like every other
 * card; that is only true when there is one place that says what a card is.
 *
 * It groups: a distinct object, a titled block, one item of a collection. It is
 * not layout — a page section is space and a heading, not a box.
 */
export function Card<T extends ElementType = 'div'>({ as, className, padding = 'default', ...rest }: CardProps<T>) {
  const Component: ElementType = as ?? 'div';

  return <Component className={[styles.card, PADDING[padding], className].filter(Boolean).join(' ')} {...rest} />;
}
